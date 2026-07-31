<?php

namespace App\Http\Resources;

use App\Models\CommissionRule;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CommissionRule */
class CommissionRuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'user_id'        => $this->user_id,
            'user_name'      => $this->user?->name,
            'base_percent'   => (float) $this->base_percent,
            'monthly_target' => (float) $this->monthly_target,
            'target_bonus'   => (float) $this->target_bonus,
            'notes'          => $this->notes,
            'is_active'      => (bool) $this->is_active,
        ];
    }
}
