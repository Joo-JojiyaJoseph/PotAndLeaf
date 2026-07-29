<?php

namespace App\Http\Resources;

use App\Models\Purchase;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Purchase */
class PurchaseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $companyId = $this->company_id;

        return [
            'id'                => $this->id,
            'purchase_no'       => $this->purchase_no,
            'invoice_no'        => $this->invoice_no,
            'invoice_date'      => optional($this->invoice_date)->toDateString(),
            'purchase_date'     => optional($this->purchase_date)->toDateString(),
            'is_interstate'     => (bool) $this->is_interstate,
            'subtotal'          => (float) $this->subtotal,
            'discount_total'    => (float) $this->discount_total,
            'tax_total'         => (float) $this->tax_total,
            'landed_cost_total' => (float) $this->landed_cost_total,
            'grand_total'       => (float) $this->grand_total,
            'status'            => $this->status,
            'notes'             => $this->notes,
            'confirmed_at'      => optional($this->confirmed_at)->toDateTimeString(),
            'supplier'          => $this->whenLoaded('supplier', fn () => [
                'id'            => $this->supplier?->id,
                'name'          => $this->supplier?->name,
                'supplier_code' => $this->supplier?->supplier_code,
            ]),
            'items'             => PurchaseItemResource::collection($this->whenLoaded('items')),
            'can'               => [
                'update'  => $this->status === 'draft' && $user?->hasPermission('purchases.update', $companyId),
                'confirm' => $this->status === 'draft' && $user?->hasPermission('purchases.confirm', $companyId),
                'cancel'  => $this->status !== 'cancelled' && $user?->hasPermission('purchases.delete', $companyId),
            ],
        ];
    }
}
