<?php

namespace App\Actions\Sales;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Services\InventoryService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Confirming a sale draws stock down (COGS at each product's cost price), and
 * updates the customer's outstanding (credit sales) and loyalty points
 * (1 point per ₹100 of bill value). Guarded against overselling.
 */
class ConfirmSale
{
    public function __construct(private readonly InventoryService $inventory) {}

    public function handle(Sale $sale, ?int $userId = null): Sale
    {
        if (! $sale->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft sales can be confirmed.']);
        }

        return DB::transaction(function () use ($sale, $userId) {
            $sale->loadMissing('items');

            foreach ($sale->items as $item) {
                if (! $item->product_id) {
                    continue;
                }
                $product = Product::forCompany($sale->company_id)->lockForUpdate()->find($item->product_id);
                if (! $product) {
                    continue;
                }
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

            if ($sale->customer_id) {
                $customer = Customer::forCompany($sale->company_id)->lockForUpdate()->find($sale->customer_id);
                if ($customer) {
                    if ($sale->payment_mode === 'credit') {
                        $customer->outstanding = (float) $customer->outstanding + ((float) $sale->grand_total - (float) $sale->amount_paid);
                    }
                    $customer->loyalty_points = (int) $customer->loyalty_points + (int) floor((float) $sale->grand_total / 100);
                    $customer->save();
                }
            }

            $sale->update(['status' => 'confirmed', 'confirmed_at' => now()]);

            return $sale->refresh()->load(['items', 'customer:id,name,type']);
        });
    }
}
