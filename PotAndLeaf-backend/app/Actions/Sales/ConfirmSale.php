<?php

namespace App\Actions\Sales;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Location;
use App\Services\InventoryService;
use App\Services\LocationStockService;
use App\Services\LoyaltyService;
use App\Services\PoolStockService;
use App\Services\SupervisorCommissionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Confirming a sale draws stock down (COGS at each product's cost price), and
 * updates the customer's outstanding (credit sales) and loyalty points.
 * Products that belong to a shared set/unit pool (see PoolStockService) are
 * drawn from the pool instead of their own current_stock.
 */
class ConfirmSale
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly LocationStockService $locations,
        private readonly LoyaltyService $loyalty,
        private readonly SupervisorCommissionService $supervisorCommission,
        private readonly PoolStockService $pool,
    ) {}

    public function handle(Sale $sale, ?int $userId = null): Sale
    {
        if (! $sale->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft sales can be confirmed.']);
        }

        return DB::transaction(function () use ($sale, $userId) {
            $sale->loadMissing('items');

            $location = $sale->location_id
                ? Location::forCompany($sale->company_id)->find($sale->location_id)
                : $this->locations->defaultLocation($sale->company_id);

            foreach ($sale->items as $item) {
                if (! $item->product_id) {
                    continue;
                }
                $product = Product::forCompany($sale->company_id)->lockForUpdate()->find($item->product_id);
                if (! $product) {
                    continue;
                }

                if ($this->pool->isPooled($product)) {
                    $available = $this->pool->availableStock($product);
                    if ($available < (float) $item->qty) {
                        throw ValidationException::withMessages([
                            'items' => "Not enough stock for {$product->name}: {$available} available, {$item->qty} required.",
                        ]);
                    }
                    $this->pool->deduct(
                        $product, (float) $item->qty, 'sale', $sale->id, "Sale {$sale->sale_no}", $userId,
                    );
                    $product->refresh();
                } else {
                    if ((float) $product->current_stock < (float) $item->qty) {
                        throw ValidationException::withMessages([
                            'items' => "Not enough stock for {$product->name}: {$product->current_stock} available, {$item->qty} required.",
                        ]);
                    }
                    $this->inventory->post(
                        product: $product, direction: 'out', qty: (float) $item->qty,
                        unitCost: (float) $product->cost_price, referenceType: 'sale',
                        referenceId: $sale->id, note: "Sale {$sale->sale_no}", userId: $userId,
                    );
                    $product->save();
                }

                if ($location) {
                    $this->locations->adjust($sale->company_id, $location->id, $product->id, 'out', (float) $item->qty);
                }

                $this->supervisorCommission->accrue(
                    $sale->company_id,
                    $product->id,
                    (float) $item->qty,
                    'sale',
                    'sale',
                    $sale->id,
                    (float) $item->rate,
                );
            }

            if ($sale->customer_id) {
                $customer = Customer::forCompany($sale->company_id)->lockForUpdate()->find($sale->customer_id);
                if ($customer) {
                    $due = max(0, (float) $sale->grand_total - (float) $sale->loyalty_discount);
                    if ($sale->payment_mode === 'credit') {
                        $customer->outstanding = (float) $customer->outstanding + ($due - (float) $sale->amount_paid);
                        $customer->save();
                    }

                    $redeemed = (int) $sale->loyalty_points_redeemed;
                    if ($redeemed > 0) {
                        if ((int) $customer->loyalty_points < $redeemed) {
                            throw ValidationException::withMessages([
                                'loyalty_points_redeemed' => 'Customer no longer has enough loyalty points.',
                            ]);
                        }
                        $this->loyalty->postRedeem($customer, $redeemed, $sale);
                        $customer->refresh();
                    }

                    $earnBase = max(0, (float) $sale->grand_total - (float) $sale->loyalty_discount);
                    $earned = $this->loyalty->pointsEarned($sale->company_id, $earnBase);
                    $this->loyalty->postEarn($customer, $earned, $sale);
                }
            }

            $sale->update(['status' => 'confirmed', 'confirmed_at' => now()]);

            return $sale->refresh()->load(['items', 'customer:id,name,type,loyalty_points']);
        });
    }
}
