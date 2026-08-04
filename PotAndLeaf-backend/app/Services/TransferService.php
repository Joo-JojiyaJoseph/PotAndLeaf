<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StockTransfer;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TransferService
{
    public function __construct(
        private readonly LocationStockService $locations,
        private readonly SupervisorCommissionService $supervisorCommission,
    ) {}

    public function list(int|string $companyId, array $filters): LengthAwarePaginator
    {
        return StockTransfer::forCompany($companyId)
            ->with(['fromLocation:id,name', 'toLocation:id,name'])
            ->withCount('items')
            ->when(filled($filters['status'] ?? null), fn ($q) => $q->where('status', $filters['status']))
            ->when(filled($filters['search'] ?? null), fn ($q) => $q->where('transfer_no', 'like', "%{$filters['search']}%"))
            ->orderByDesc('transfer_date')->orderByDesc('created_at')
            ->paginate(min((int) ($filters['per_page'] ?? 15), 100))
            ->withQueryString();
    }

    public function find(int|string $companyId, string $id): ?StockTransfer
    {
        return StockTransfer::forCompany($companyId)
            ->with(['items', 'fromLocation:id,name', 'toLocation:id,name'])
            ->whereKey($id)->first();
    }

    public function create(int|string $companyId, array $data, ?int $userId = null): StockTransfer
    {
        $names = Product::forCompany($companyId)
            ->whereIn('id', collect($data['items'])->pluck('product_id'))
            ->pluck('name', 'id');

        return DB::transaction(function () use ($companyId, $data, $names) {
            $transfer = StockTransfer::create([
                'company_id'       => $companyId,
                'from_location_id' => $data['from_location_id'],
                'to_location_id'   => $data['to_location_id'],
                'transfer_no'      => $this->nextTransferNo($companyId),
                'transfer_date'    => $data['transfer_date'],
                'status'           => 'draft',
                'notes'            => $data['notes'] ?? null,
            ]);

            $transfer->items()->createMany(collect($data['items'])->map(fn ($i) => [
                'product_id'   => $i['product_id'],
                'product_name' => $names[$i['product_id']] ?? 'Item',
                'qty'          => $i['qty'],
                'received_qty' => 0,
            ])->all());

            return $transfer->load(['items', 'fromLocation:id,name', 'toLocation:id,name']);
        });
    }

    /** Dispatch: remove from source, mark in-transit. Guards against short source stock. */
    public function dispatch(StockTransfer $transfer, ?int $userId = null): StockTransfer
    {
        if (! $transfer->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft transfers can be dispatched.']);
        }

        return DB::transaction(function () use ($transfer) {
            $transfer->loadMissing('items');

            foreach ($transfer->items as $item) {
                if (! $item->product_id) {
                    continue;
                }
                $available = $this->locations->available($transfer->from_location_id, $item->product_id);
                if ($available < (float) $item->qty) {
                    throw ValidationException::withMessages([
                        'items' => "Not enough at source for {$item->product_name}: {$available} available, {$item->qty} needed.",
                    ]);
                }
            }
            foreach ($transfer->items as $item) {
                if ($item->product_id) {
                    $this->locations->adjust($transfer->company_id, $transfer->from_location_id, $item->product_id, 'out', (float) $item->qty);
                    $product = Product::find($item->product_id);
                    $this->supervisorCommission->accrue(
                        $transfer->company_id,
                        $item->product_id,
                        (float) $item->qty,
                        'transfer',
                        'stock-transfer',
                        $transfer->id,
                        (float) ($product?->cost_price ?? 0),
                    );
                }
            }

            $transfer->update(['status' => 'in_transit', 'dispatched_at' => now()]);

            return $transfer->refresh()->load(['items', 'fromLocation:id,name', 'toLocation:id,name']);
        });
    }

    /**
     * Receive: accepted qty goes to destination, any rejected remainder returns
     * to the source. $receipts is [item_id => received_qty].
     */
    public function receive(StockTransfer $transfer, array $receipts, ?int $userId = null): StockTransfer
    {
        if (! $transfer->isInTransit()) {
            throw ValidationException::withMessages(['status' => 'Only in-transit transfers can be received.']);
        }

        return DB::transaction(function () use ($transfer, $receipts) {
            $transfer->loadMissing('items');

            foreach ($transfer->items as $item) {
                if (! $item->product_id) {
                    continue;
                }
                $requested = array_key_exists($item->id, $receipts) ? (float) $receipts[$item->id] : (float) $item->qty;
                $received = max(0.0, min($requested, (float) $item->qty));
                $rejected = (float) $item->qty - $received;

                if ($received > 0) {
                    $this->locations->adjust($transfer->company_id, $transfer->to_location_id, $item->product_id, 'in', $received);
                }
                if ($rejected > 0) {
                    $this->locations->adjust($transfer->company_id, $transfer->from_location_id, $item->product_id, 'in', $rejected);
                }
                $item->update(['received_qty' => $received]);
            }

            $transfer->update(['status' => 'received', 'received_at' => now()]);

            return $transfer->refresh()->load(['items', 'fromLocation:id,name', 'toLocation:id,name']);
        });
    }

    /** Cancel: in-transit stock returns to source; drafts just close. */
    public function cancel(StockTransfer $transfer, ?int $userId = null): StockTransfer
    {
        return DB::transaction(function () use ($transfer) {
            if ($transfer->isInTransit()) {
                $transfer->loadMissing('items');
                foreach ($transfer->items as $item) {
                    if ($item->product_id) {
                        $this->locations->adjust($transfer->company_id, $transfer->from_location_id, $item->product_id, 'in', (float) $item->qty);
                    }
                }
            }
            $transfer->update(['status' => 'cancelled']);

            return $transfer->refresh();
        });
    }

    private function nextTransferNo(int|string $companyId): string
    {
        $count = StockTransfer::withTrashed()->forCompany($companyId)->count();

        return 'TRF-'.str_pad((string) ($count + 1), 6, '0', STR_PAD_LEFT);
    }
}
