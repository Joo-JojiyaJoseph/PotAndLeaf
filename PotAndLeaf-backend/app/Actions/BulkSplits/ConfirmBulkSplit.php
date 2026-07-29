<?php

namespace App\Actions\BulkSplits;

use App\Models\BulkSplit;
use App\Models\Product;
use App\Services\InventoryService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Confirming a split posts the stock: the source is drawn down and each output
 * is received at its redistributed unit cost (which also becomes the output's
 * new cost price). Guarded so the source can't go negative.
 */
class ConfirmBulkSplit
{
    public function __construct(private readonly InventoryService $inventory) {}

    public function handle(BulkSplit $split, ?int $userId = null): BulkSplit
    {
        if (! $split->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft splits can be confirmed.']);
        }

        return DB::transaction(function () use ($split, $userId) {
            $split->loadMissing('items');

            $source = Product::forCompany($split->company_id)->lockForUpdate()->find($split->source_product_id);
            if (! $source) {
                throw ValidationException::withMessages(['source_product_id' => 'Source product no longer exists.']);
            }
            if ((float) $source->current_stock < (float) $split->source_qty) {
                throw ValidationException::withMessages([
                    'source_qty' => "Not enough stock: {$source->current_stock} available, {$split->source_qty} required.",
                ]);
            }

            $this->inventory->post(
                product: $source, direction: 'out', qty: (float) $split->source_qty,
                unitCost: (float) $split->source_unit_cost, referenceType: 'bulk-split',
                referenceId: $split->id, note: "Split {$split->split_no}", userId: $userId,
            );
            $source->save();

            foreach ($split->items as $item) {
                if (! $item->product_id) {
                    continue;
                }
                $target = Product::forCompany($split->company_id)->lockForUpdate()->find($item->product_id);
                if (! $target) {
                    continue;
                }
                $this->inventory->post(
                    product: $target, direction: 'in', qty: (float) $item->qty,
                    unitCost: (float) $item->unit_cost, referenceType: 'bulk-split',
                    referenceId: $split->id, note: "Split {$split->split_no}", userId: $userId,
                );
                $target->cost_price = $item->unit_cost;
                $target->save();
            }

            $split->update(['status' => 'confirmed', 'confirmed_at' => now()]);

            return $split->refresh()->load(['items', 'sourceProduct:id,sku,name']);
        });
    }
}
