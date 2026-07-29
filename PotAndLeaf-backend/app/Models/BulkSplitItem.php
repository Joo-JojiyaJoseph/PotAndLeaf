<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BulkSplitItem extends Model
{
    use HasUuids;

    protected $fillable = [
        'bulk_split_id', 'product_id', 'product_name', 'qty', 'weight',
        'cost_alloc', 'unit_cost',
    ];

    protected function casts(): array
    {
        return [
            'qty'        => 'decimal:3',
            'weight'     => 'decimal:3',
            'cost_alloc' => 'decimal:2',
            'unit_cost'  => 'decimal:4',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
