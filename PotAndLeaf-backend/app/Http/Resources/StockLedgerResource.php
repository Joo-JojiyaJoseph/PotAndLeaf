<?php

namespace App\Http\Resources;

use App\Models\StockLedgerEntry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin StockLedgerEntry */
class StockLedgerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'direction'      => $this->direction,
            'qty'            => (float) $this->qty,
            'unit_cost'      => $this->unit_cost !== null ? (float) $this->unit_cost : null,
            'balance_after'  => (float) $this->balance_after,
            'reference_type' => $this->reference_type,
            'reference_id'   => $this->reference_id,
            'note'           => $this->note,
            'occurred_at'    => optional($this->occurred_at)->toDateTimeString(),
            'product'        => $this->whenLoaded('product', fn () => [
                'id'   => $this->product?->id,
                'sku'  => $this->product?->sku,
                'name' => $this->product?->name,
            ]),
        ];
    }
}
