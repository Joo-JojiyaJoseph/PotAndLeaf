<?php

namespace App\Models;

use App\Models\Concerns\HasAuditColumns;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Rental extends Model
{
    use HasAuditColumns, HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'company_id', 'customer_id', 'location_id', 'rental_no', 'start_date',
        'expected_end_date', 'billing_cycle', 'deposit', 'status', 'notes',
        'activated_at', 'returned_at',
    ];

    protected function casts(): array
    {
        return [
            'start_date'        => 'date',
            'expected_end_date' => 'date',
            'deposit'           => 'decimal:2',
            'activated_at'      => 'datetime',
            'returned_at'       => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(RentalItem::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(RentalInvoice::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function scopeForCompany($query, int|string $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
