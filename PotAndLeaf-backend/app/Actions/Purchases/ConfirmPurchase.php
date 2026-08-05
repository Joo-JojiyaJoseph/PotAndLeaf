<?php

namespace App\Actions\Purchases;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Services\ActivityLogService;
use App\Services\InventoryService;
use App\Services\SellAsFulfillmentService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Confirming a purchase is the point stock becomes real: each line posts an
 * "in" movement to the ledger, the product's current_stock rises, and its
 * cost_price is refreshed to the landed unit cost. All within one transaction.
 * Bulk lines with a `sell_as` strategy are delegated to
 * SellAsFulfillmentService instead, which decides where the stock lands
 * (set product, split units, or a shared pool of both).
 */
class ConfirmPurchase
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly SellAsFulfillmentService $sellAs,
        private readonly ActivityLogService $activity,
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

                if ($item->is_bulk && $item->sell_as) {
                    // Delegates entirely — the set/unit product(s) it stocks may
                    // differ from the purchased line's own product, so the normal
                    // location adjustment below (keyed on $product) doesn't apply.
                    $this->sellAs->fulfil($purchase, $item, $product, $userId);
                    $item->save();
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
            }

            // A confirmed purchase is money owed to the supplier.
            $supplier = Supplier::where('company_id', $purchase->company_id)
                ->lockForUpdate()->find($purchase->supplier_id);
            if ($supplier) {
                $supplier->outstanding = (float) $supplier->outstanding + (float) $purchase->grand_total;
                $supplier->save();
            }

            $purchase->update(['status' => 'confirmed', 'confirmed_at' => now()]);

            $this->activity->log(
                $purchase->company_id, $userId, 'confirm', 'purchases', 'purchase', $purchase->id,
                "Purchase {$purchase->purchase_no} confirmed",
                ['grand_total' => (float) $purchase->grand_total, 'created_by' => $purchase->created_by],
            );

            return $purchase->refresh()->load(['supplier', 'items', 'createdBy:id,name']);
        });
    }
}
