<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentalItem extends Model
{
    use HasUuids;

    protected $fillable = ['rental_id', 'product_id', 'product_name', 'qty', 'rate_per_cycle', 'returned_qty'];

    protected function casts(): array
    {
        return ['qty' => 'decimal:3', 'rate_per_cycle' => 'decimal:2', 'returned_qty' => 'decimal:3'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
