<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Location;
use App\Models\Product;
use App\Models\Rental;
use App\Models\RentalInvoice;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RentalService
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly LocationStockService $locations,
    ) {}

    public function list(int|string $companyId, array $filters): LengthAwarePaginator
    {
        return Rental::forCompany($companyId)
            ->with('customer:id,name')
            ->withCount('items')
            ->when(filled($filters['status'] ?? null), fn ($q) => $q->where('status', $filters['status']))
            ->when(filled($filters['search'] ?? null), fn ($q) => $q->where('rental_no', 'like', "%{$filters['search']}%"))
            ->orderByDesc('start_date')->orderByDesc('created_at')
            ->paginate(min((int) ($filters['per_page'] ?? 15), 100))
            ->withQueryString();
    }

    public function find(int|string $companyId, string $id): ?Rental
    {
        return Rental::forCompany($companyId)
            ->with(['items', 'invoices' => fn ($q) => $q->orderByDesc('period_from'), 'customer:id,name,type'])
            ->whereKey($id)->first();
    }

    public function create(int|string $companyId, array $data, ?int $userId = null): Rental
    {
        $names = Product::forCompany($companyId)
            ->whereIn('id', collect($data['items'])->pluck('product_id')->filter())
            ->pluck('name', 'id');

        return DB::transaction(function () use ($companyId, $data, $names) {
            $rental = Rental::create([
                'company_id'        => $companyId,
                'customer_id'       => $data['customer_id'],
                'location_id'       => $data['location_id'] ?? null,
                'rental_no'         => $this->nextRentalNo($companyId),
                'start_date'        => $data['start_date'],
                'expected_end_date' => $data['expected_end_date'] ?? null,
                'billing_cycle'     => $data['billing_cycle'] ?? 'monthly',
                'deposit'           => $data['deposit'] ?? 0,
                'status'            => 'draft',
                'notes'             => $data['notes'] ?? null,
            ]);

            $rental->items()->createMany(collect($data['items'])->map(fn ($i) => [
                'product_id'     => $i['product_id'],
                'product_name'   => $names[$i['product_id']] ?? 'Item',
                'qty'            => $i['qty'],
                'rate_per_cycle' => $i['rate_per_cycle'] ?? 0,
                'returned_qty'   => 0,
            ])->all());

            return $rental->load(['items', 'customer:id,name,type']);
        });
    }

    /** Activate: rented stock leaves inventory. */
    public function activate(Rental $rental, ?int $userId = null): Rental
    {
        if (! $rental->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft rentals can be activated.']);
        }

        return DB::transaction(function () use ($rental, $userId) {
            $rental->loadMissing('items');
            $location = $this->resolveLocation($rental);

            foreach ($rental->items as $item) {
                if (! $item->product_id) {
                    continue;
                }
                $product = Product::forCompany($rental->company_id)->lockForUpdate()->find($item->product_id);
                if (! $product) {
                    continue;
                }
                if ((float) $product->current_stock < (float) $item->qty) {
                    throw ValidationException::withMessages([
                        'items' => "Not enough {$product->name}: {$product->current_stock} available, {$item->qty} required.",
                    ]);
                }
                $this->inventory->post(
                    product: $product, direction: 'out', qty: (float) $item->qty,
                    unitCost: (float) $product->cost_price, referenceType: 'rental',
                    referenceId: $rental->id, note: "Rental {$rental->rental_no}", userId: $userId,
                );
                $product->save();
                if ($location) {
                    $this->locations->adjust($rental->company_id, $location->id, $product->id, 'out', (float) $item->qty);
                }
            }

            $rental->update(['status' => 'active', 'activated_at' => now()]);

            return $rental->refresh()->load(['items', 'customer:id,name,type']);
        });
    }

    /** Return some or all rented units; stock comes back. Closes when everything is back. */
    public function returnItems(Rental $rental, array $returns, ?int $userId = null): Rental
    {
        if (! $rental->isActive()) {
            throw ValidationException::withMessages(['status' => 'Only active rentals can be returned.']);
        }

        return DB::transaction(function () use ($rental, $returns, $userId) {
            $rental->loadMissing('items');
            $location = $this->resolveLocation($rental);

            foreach ($rental->items as $item) {
                if (! $item->product_id) {
                    continue;
                }
                $outstanding = (float) $item->qty - (float) $item->returned_qty;
                $requested = array_key_exists($item->id, $returns) ? (float) $returns[$item->id] : 0.0;
                $back = max(0.0, min($requested, $outstanding));
                if ($back <= 0) {
                    continue;
                }
                $product = Product::forCompany($rental->company_id)->lockForUpdate()->find($item->product_id);
                if ($product) {
                    $this->inventory->post(
                        product: $product, direction: 'in', qty: $back,
                        unitCost: (float) $product->cost_price, referenceType: 'rental-return',
                        referenceId: $rental->id, note: "Return {$rental->rental_no}", userId: $userId,
                    );
                    $product->save();
                    if ($location) {
                        $this->locations->adjust($rental->company_id, $location->id, $product->id, 'in', $back);
                    }
                }
                $item->update(['returned_qty' => (float) $item->returned_qty + $back]);
            }

            $allBack = $rental->items->every(fn ($i) => (float) $i->returned_qty >= (float) $i->qty);
            if ($allBack) {
                $rental->update(['status' => 'returned', 'returned_at' => now()]);
            }

            return $rental->refresh()->load(['items', 'invoices', 'customer:id,name,type']);
        });
    }

    public function cancel(Rental $rental, ?int $userId = null): Rental
    {
        return DB::transaction(function () use ($rental, $userId) {
            if ($rental->isActive()) {
                $rental->loadMissing('items');
                $location = $this->resolveLocation($rental);
                foreach ($rental->items as $item) {
                    $outstanding = (float) $item->qty - (float) $item->returned_qty;
                    if ($outstanding <= 0 || ! $item->product_id) {
                        continue;
                    }
                    $product = Product::forCompany($rental->company_id)->lockForUpdate()->find($item->product_id);
                    if ($product) {
                        $this->inventory->post(
                            product: $product, direction: 'in', qty: $outstanding,
                            unitCost: (float) $product->cost_price, referenceType: 'rental-cancel',
                            referenceId: $rental->id, note: "Cancel {$rental->rental_no}", userId: $userId,
                        );
                        $product->save();
                        if ($location) {
                            $this->locations->adjust($rental->company_id, $location->id, $product->id, 'in', $outstanding);
                        }
                    }
                    $item->update(['returned_qty' => (float) $item->qty]);
                }
            }
            $rental->update(['status' => 'cancelled']);

            return $rental->refresh();
        });
    }

    // ---- Billing ----

    public function generateInvoice(int|string $companyId, Rental $rental, array $data, ?int $userId = null): RentalInvoice
    {
        $from = Carbon::parse($data['period_from']);
        $to = Carbon::parse($data['period_to']);
        if ($to->lt($from)) {
            throw ValidationException::withMessages(['period_to' => 'End of period must be on or after the start.']);
        }

        $days = $from->diffInDays($to) + 1;
        $cycleDays = ['daily' => 1, 'weekly' => 7, 'monthly' => 30][$rental->billing_cycle] ?? 30;
        $cycles = max(1, (int) ceil($days / $cycleDays));

        $rental->loadMissing('items');
        $amount = round($rental->items->sum(function ($i) use ($cycles) {
            $activeQty = (float) $i->qty - (float) $i->returned_qty;
            return $activeQty * (float) $i->rate_per_cycle * $cycles;
        }), 2);

        return DB::transaction(function () use ($companyId, $rental, $from, $to, $cycles, $amount) {
            $invoice = RentalInvoice::create([
                'company_id'  => $companyId,
                'rental_id'   => $rental->id,
                'invoice_no'  => $this->nextInvoiceNo($companyId),
                'period_from' => $from->toDateString(),
                'period_to'   => $to->toDateString(),
                'cycles'      => $cycles,
                'amount'      => $amount,
                'status'      => 'unpaid',
            ]);

            $this->adjustCustomerOutstanding($rental->company_id, $rental->customer_id, $amount);

            return $invoice;
        });
    }

    public function markInvoicePaid(RentalInvoice $invoice): RentalInvoice
    {
        if ($invoice->status !== 'paid') {
            DB::transaction(function () use ($invoice) {
                $invoice->update(['status' => 'paid']);
                $rental = $invoice->rental()->first();
                if ($rental) {
                    $this->adjustCustomerOutstanding($invoice->company_id, $rental->customer_id, -(float) $invoice->amount);
                }
            });
        }

        return $invoice->refresh();
    }

    public function deleteInvoice(RentalInvoice $invoice): void
    {
        DB::transaction(function () use ($invoice) {
            // Only an unpaid invoice still sits on the customer's outstanding.
            if ($invoice->status === 'unpaid') {
                $rental = $invoice->rental()->first();
                if ($rental) {
                    $this->adjustCustomerOutstanding($invoice->company_id, $rental->customer_id, -(float) $invoice->amount);
                }
            }
            $invoice->delete();
        });
    }

    private function adjustCustomerOutstanding(int|string $companyId, string $customerId, float $delta): void
    {
        $customer = Customer::forCompany($companyId)->lockForUpdate()->find($customerId);
        if ($customer) {
            $customer->outstanding = (float) $customer->outstanding + $delta;
            $customer->save();
        }
    }

    private function resolveLocation(Rental $rental): ?Location
    {
        return $rental->location_id
            ? Location::forCompany($rental->company_id)->find($rental->location_id)
            : $this->locations->defaultLocation($rental->company_id);
    }

    private function nextRentalNo(int|string $companyId): string
    {
        $count = Rental::withTrashed()->forCompany($companyId)->count();

        return 'RNT-'.str_pad((string) ($count + 1), 6, '0', STR_PAD_LEFT);
    }

    private function nextInvoiceNo(int|string $companyId): string
    {
        $count = RentalInvoice::forCompany($companyId)->count();

        return 'RINV-'.str_pad((string) ($count + 1), 6, '0', STR_PAD_LEFT);
    }
}
