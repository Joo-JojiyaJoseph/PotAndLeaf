<?php

namespace App\Models;

use App\Models\Concerns\HasAuditColumns;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Purchase extends Model
{
    use HasAuditColumns, HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'company_id', 'supplier_id', 'purchase_no', 'invoice_no', 'invoice_date',
        'purchase_date', 'is_interstate', 'subtotal', 'discount_total', 'tax_total',
        'landed_cost_total', 'grand_total', 'status', 'notes', 'confirmed_at',
    ];

    protected function casts(): array
    {
        return [
            'invoice_date'      => 'date',
            'purchase_date'     => 'date',
            'is_interstate'     => 'boolean',
            'subtotal'          => 'decimal:2',
            'discount_total'    => 'decimal:2',
            'tax_total'         => 'decimal:2',
            'landed_cost_total' => 'decimal:2',
            'grand_total'       => 'decimal:2',
            'confirmed_at'      => 'datetime',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function scopeForCompany($query, int|string $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function isConfirmed(): bool
    {
        return $this->status === 'confirmed';
    }
}
