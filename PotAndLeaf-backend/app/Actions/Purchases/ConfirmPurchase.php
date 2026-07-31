<?php

namespace App\Actions\Purchases;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\Location;
use App\Services\InventoryService;
use App\Services\LocationStockService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Confirming a purchase is the point stock becomes real: each line posts an
 * "in" movement to the ledger, the product's current_stock rises, and its
 * cost_price is refreshed to the landed unit cost. All within one transaction.
 */
class ConfirmPurchase
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly LocationStockService $locations,
    ) {}

    public function handle(Purchase $purchase, ?int $userId = null): Purchase
    {
        if (! $purchase->isDraft()) {
            throw ValidationException::withMessages([
                'status' => 'Only draft purchases can be confirmed.',
            ]);
        }

        return DB::transaction(function () use ($purchase, $userId) {
            $purchase->loadMissing('items');

            // Where the received stock physically lands (falls back to the default location).
            $location = $purchase->location_id
                ? Location::forCompany($purchase->company_id)->find($purchase->location_id)
                : $this->locations->defaultLocation($purchase->company_id);

            foreach ($purchase->items as $item) {
                if (! $item->product_id) {
                    continue; // free-text line, nothing to stock
                }

                $product = Product::forCompany($purchase->company_id)
                    ->lockForUpdate()
                    ->find($item->product_id);

                if (! $product) {
                    continue;
                }

                $this->inventory->post(
                    product: $product,
                    direction: 'in',
                    qty: (float) $item->qty,
                    unitCost: (float) $item->landed_unit_cost,
                    referenceType: 'purchase',
                    referenceId: $purchase->id,
                    note: "Purchase {$purchase->purchase_no}",
                    userId: $userId,
                );

                $product->cost_price = $item->landed_unit_cost;
                $product->save();

                if ($location) {
                    $this->locations->adjust($purchase->company_id, $location->id, $product->id, 'in', (float) $item->qty);
                }
            }

            // A confirmed purchase is money owed to the supplier.
            $supplier = Supplier::where('company_id', $purchase->company_id)
                ->lockForUpdate()->find($purchase->supplier_id);
            if ($supplier) {
                $supplier->outstanding = (float) $supplier->outstanding + (float) $purchase->grand_total;
                $supplier->save();
            }

            $purchase->update(['status' => 'confirmed', 'confirmed_at' => now()]);

            return $purchase->refresh()->load(['supplier', 'items']);
        });
    }
}
