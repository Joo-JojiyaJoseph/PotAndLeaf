<?php

namespace App\Http\Resources;

use App\Models\StockTransfer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin StockTransfer */
class StockTransferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $companyId = $this->company_id;

        return [
            'id'            => $this->id,
            'transfer_no'   => $this->transfer_no,
            'transfer_date' => optional($this->transfer_date)->toDateString(),
            'from_location_id' => $this->from_location_id,
            'to_location_id'   => $this->to_location_id,
            'from_location' => $this->fromLocation?->name,
            'to_location'   => $this->toLocation?->name,
            'status'        => $this->status,
            'notes'         => $this->notes,
            'dispatched_at' => optional($this->dispatched_at)->toIso8601String(),
            'received_at'   => optional($this->received_at)->toIso8601String(),
            'items_count'   => $this->when($this->items_count !== null, $this->items_count),
            'items'         => $this->whenLoaded('items', fn () => $this->items->map(fn ($i) => [
                'id' => $i->id, 'product_id' => $i->product_id, 'product_name' => $i->product_name,
                'qty' => (float) $i->qty, 'received_qty' => (float) $i->received_qty,
            ])->values()),
            'can'           => [
                'dispatch' => $this->status === 'draft' && $user?->hasPermission('transfers.dispatch', $companyId),
                'receive'  => $this->status === 'in_transit' && $user?->hasPermission('transfers.receive', $companyId),
                'cancel'   => in_array($this->status, ['draft', 'in_transit'], true) && $user?->hasPermission('transfers.delete', $companyId),
            ],
        ];
    }
}
