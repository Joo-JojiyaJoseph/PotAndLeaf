<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StockLedgerEntry;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Owns stock movements. Every change goes through post(), which appends a
 * ledger row carrying the running balance and mutates the product's
 * current_stock in memory (the caller persists inside its own transaction, so
 * a whole purchase posts atomically). Reads for the inventory screens live
 * here too.
 */
class InventoryService
{
    /**
     * Record one movement. Does not open a transaction or save the product —
     * the caller controls both so multi-line documents post atomically.
     */
    public function post(
        Product $product,
        string $direction,
        float $qty,
        ?float $unitCost,
        string $referenceType,
        ?string $referenceId = null,
        ?string $note = null,
        ?int $userId = null,
    ): StockLedgerEntry {
        $delta = $direction === 'in' ? $qty : -$qty;
        $newBalance = (float) $product->current_stock + $delta;
        $product->current_stock = $newBalance;

        return StockLedgerEntry::create([
            'company_id'        => $product->company_id,
            'product_id'     => $product->id,
            'direction'      => $direction,
            'qty'            => $qty,
            'unit_cost'      => $unitCost,
            'balance_after'  => $newBalance,
            'reference_type' => $referenceType,
            'reference_id'   => $referenceId,
            'note'           => $note,
            'occurred_at'    => now(),
            'created_by'     => $userId,
        ]);
    }

    /** @param array<string,mixed> $filters */
    public function stockLevels(int|string $companyId, array $filters): LengthAwarePaginator
    {
        $perPage = min((int) ($filters['per_page'] ?? 20), 100);

        return Product::query()
            ->forCompany($companyId)
            ->when(filled($filters['search'] ?? null), fn ($q) => $q->search($filters['search']))
            ->when(($filters['low_only'] ?? false), fn ($q) => $q->whereColumn('current_stock', '<=', 'reorder_level'))
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function reorderAlerts(int|string $companyId): \Illuminate\Support\Collection
    {
        return Product::query()
            ->forCompany($companyId)
            ->whereColumn('current_stock', '<=', 'reorder_level')
            ->orderBy('name')
            ->get(['id', 'sku', 'name', 'current_stock', 'reorder_level']);
    }

    public function ledgerFor(int|string $companyId, string $productId): LengthAwarePaginator
    {
        return StockLedgerEntry::query()
            ->forCompany($companyId)
            ->where('product_id', $productId)
            ->with('product:id,sku,name')
            ->latest('occurred_at')
            ->paginate(30)
            ->withQueryString();
    }
}
