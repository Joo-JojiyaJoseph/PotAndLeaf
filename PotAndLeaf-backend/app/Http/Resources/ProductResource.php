<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'sku'             => $this->sku,
            'name'            => $this->name,
            'barcode'         => $this->barcode,
            'hsn_code'        => $this->hsn_code,
            'description'     => $this->description,
            'category_id'     => $this->category_id,
            'brand_id'        => $this->brand_id,
            'unit_id'         => $this->unit_id,
            'category'        => $this->whenLoaded('category', fn () => $this->category?->name),
            'brand'           => $this->whenLoaded('brand', fn () => $this->brand?->name),
            'unit'            => $this->whenLoaded('unit', fn () => $this->unit?->short_name ?? $this->unit?->name),
            'gst_rate'        => (float) $this->gst_rate,
            'mrp'             => (float) $this->mrp,
            'cost_price'      => (float) $this->cost_price,
            'dealer_price'    => (float) $this->dealer_price,
            'wholesale_price' => (float) $this->wholesale_price,
            'retail_price'    => (float) $this->retail_price,
            'reorder_level'   => (float) $this->reorder_level,
            'opening_stock'   => (float) $this->opening_stock,
            'current_stock'   => (float) $this->current_stock,
            'is_low_stock'    => $this->is_low_stock,
            'images'          => $this->images ?? [],
            'status'          => $this->status,
            'suppliers'       => $this->whenLoaded('suppliers', fn () => $this->suppliers->map(fn ($s) => [
                'supplier_id'    => $s->id,
                'name'           => $s->name,
                'supplier_price' => (float) $s->pivot->supplier_price,
                'is_primary'     => (bool) $s->pivot->is_primary,
            ])->values()),
            'can' => [
                'update' => $request->user()?->can('update', $this->resource),
                'delete' => $request->user()?->can('delete', $this->resource),
            ],
        ];
    }
}
