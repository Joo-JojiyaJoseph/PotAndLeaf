<?php

namespace App\Actions\Purchases;

use App\Models\Product;
use App\Models\Purchase;
use App\Services\InventoryService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Confirming a purchase is the point stock becomes real: each line posts an
 * "in" movement to the ledger, the product's current_stock rises, and its
 * cost_price is refreshed to the landed unit cost. All within one transaction.
 */
class ConfirmPurchase
{
    public function __construct(private readonly InventoryService $inventory) {}

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

            $purchase->update(['status' => 'confirmed', 'confirmed_at' => now()]);

            return $purchase->refresh()->load(['supplier', 'items']);
        });
    }
}
