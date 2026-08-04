<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Support\Barcode\BarcodeGenerator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * At purchase-confirm time, a bulk line's `sell_as` choice decides where the
 * received stock lands:
 *  - set_only:   stock the set product only (default: the purchased product itself).
 *  - split_only: convert immediately into the target unit product; no set stock.
 *  - both:       link a set + unit product into a shared pool (see PoolStockService)
 *                and receive the physical units into the pool.
 * Missing set/unit SKUs are auto-provisioned (barcode + SKU) so operators
 * aren't forced to pre-create them before purchasing.
 */
class SellAsFulfillmentService
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly PoolStockService $pool,
        private readonly BarcodeGenerator $barcodes,
    ) {}

    public function fulfil(Purchase $purchase, PurchaseItem $item, Product $purchasedProduct, ?int $userId): void
    {
        $qty = (float) $item->qty;
        $unitsPerSet = (float) ($item->units_per_set ?: 1);
        $note = "Purchase {$purchase->purchase_no}";

        match ($item->sell_as) {
            'set_only'   => $this->stockSetOnly($item, $purchasedProduct, $qty, $purchase, $note, $userId),
            'split_only' => $this->stockSplitOnly($item, $purchasedProduct, $qty, $unitsPerSet, $purchase, $note, $userId),
            'both'       => $this->stockShared($item, $purchasedProduct, $qty, $unitsPerSet, $purchase, $note, $userId),
            default      => null,
        };
    }

    private function stockSetOnly(PurchaseItem $item, Product $purchasedProduct, float $qty, Purchase $purchase, string $note, ?int $userId): void
    {
        $set = $item->set_product_id
            ? $this->lockedProduct($purchasedProduct->company_id, $item->set_product_id)
            : $purchasedProduct;

        $this->inventory->post(
            product: $set, direction: 'in', qty: $qty, unitCost: (float) $item->landed_unit_cost,
            referenceType: 'purchase', referenceId: $purchase->id, note: $note, userId: $userId,
        );
        $set->cost_price = $item->landed_unit_cost;
        $set->save();

        $item->set_product_id = $set->id;
    }

    private function stockSplitOnly(PurchaseItem $item, Product $purchasedProduct, float $qty, float $unitsPerSet, Purchase $purchase, string $note, ?int $userId): void
    {
        $split = $this->resolveSplitProduct($item, $purchasedProduct);
        $totalUnits = round($qty * $unitsPerSet, 3);
        $unitCost = $unitsPerSet > 0 ? round((float) $item->landed_unit_cost / $unitsPerSet, 4) : (float) $item->landed_unit_cost;

        $this->inventory->post(
            product: $split, direction: 'in', qty: $totalUnits, unitCost: $unitCost,
            referenceType: 'purchase', referenceId: $purchase->id,
            note: "{$note} (split from {$purchasedProduct->name})", userId: $userId,
        );
        $split->cost_price = $unitCost;
        $split->save();

        $item->split_product_id = $split->id;
    }

    private function stockShared(PurchaseItem $item, Product $purchasedProduct, float $qty, float $unitsPerSet, Purchase $purchase, string $note, ?int $userId): void
    {
        $set = $item->set_product_id
            ? $this->lockedProduct($purchasedProduct->company_id, $item->set_product_id)
            : $purchasedProduct;
        $unit = $this->resolveSplitProduct($item, $purchasedProduct);

        if ($set->id === $unit->id) {
            throw ValidationException::withMessages([
                'items' => 'The set product and unit product must be different for "both" bulk lines.',
            ]);
        }

        $poolGroupId = $set->pool_group_id ?: $unit->pool_group_id ?: (string) Str::uuid();

        $set->pool_group_id = $poolGroupId;
        $set->pool_role = 'set';
        $set->units_per_set = $unitsPerSet;
        $set->save();

        $unit->pool_group_id = $poolGroupId;
        $unit->pool_role = 'unit';
        $unit->units_per_set = $unitsPerSet;
        $unit->save();

        $totalUnits = round($qty * $unitsPerSet, 3);
        $unitCost = $unitsPerSet > 0 ? round((float) $item->landed_unit_cost / $unitsPerSet, 4) : (float) $item->landed_unit_cost;

        $this->pool->receive($unit, $totalUnits, $unitCost, 'purchase', $purchase->id, $note, $userId);

        $item->set_product_id = $set->id;
        $item->split_product_id = $unit->id;
        $item->shared_pool_group = $poolGroupId;
    }

    private function resolveSplitProduct(PurchaseItem $item, Product $purchasedProduct): Product
    {
        if ($item->split_product_id) {
            return $this->lockedProduct($purchasedProduct->company_id, $item->split_product_id);
        }

        return $this->provisionProduct($purchasedProduct, 'Unit', '-UNIT');
    }

    private function lockedProduct(int|string $companyId, string $id): Product
    {
        $product = Product::forCompany($companyId)->lockForUpdate()->find($id);
        if (! $product) {
            throw ValidationException::withMessages(['items' => 'Linked split/set product no longer exists.']);
        }

        return $product;
    }

    /** Auto-create a sibling SKU (e.g. "Rice Bag 50kg (Unit)") when the line didn't pick one. */
    private function provisionProduct(Product $source, string $suffixLabel, string $skuSuffix): Product
    {
        return Product::create([
            'company_id'      => $source->company_id,
            'sku'             => $this->uniqueSku($source->company_id, $source->sku . $skuSuffix),
            'name'            => "{$source->name} ({$suffixLabel})",
            'barcode'         => $this->barcodes->forProduct($source->company_id),
            'hsn_code'        => $source->hsn_code,
            'category_id'     => $source->category_id,
            'brand_id'        => $source->brand_id,
            'unit_id'         => $source->unit_id,
            'gst_rate'        => $source->gst_rate,
            'mrp'             => 0,
            'cost_price'      => 0,
            'dealer_price'    => 0,
            'wholesale_price' => 0,
            'retail_price'    => 0,
            'reorder_level'   => 0,
            'opening_stock'   => 0,
            'current_stock'   => 0,
            'status'          => 'active',
        ]);
    }

    private function uniqueSku(int|string $companyId, string $base): string
    {
        $sku = $base;
        $n = 1;
        while (Product::withTrashed()->where('company_id', $companyId)->where('sku', $sku)->exists()) {
            $n++;
            $sku = "{$base}-{$n}";
        }

        return $sku;
    }
}
