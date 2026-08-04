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

    public function ledgerFor(int|string $companyId, ?string $productId = null, ?string $referenceType = null): LengthAwarePaginator
    {
        return StockLedgerEntry::query()
            ->forCompany($companyId)
            ->when(filled($productId), fn ($q) => $q->where('product_id', $productId))
            ->when(filled($referenceType), fn ($q) => $q->where('reference_type', $referenceType))
            ->with('product:id,sku,name')
            ->latest('occurred_at')
            ->paginate(30)
            ->withQueryString();
    }

    /** Stock valuation: current_stock × cost_price per product, plus totals. */
    public function valuation(int|string $companyId): array
    {
        $rows = Product::query()
            ->forCompany($companyId)
            ->orderBy('name')
            ->get(['id', 'sku', 'name', 'current_stock', 'cost_price'])
            ->map(fn ($p) => [
                'id'    => $p->id,
                'sku'   => $p->sku,
                'name'  => $p->name,
                'stock' => (float) $p->current_stock,
                'cost'  => (float) $p->cost_price,
                'value' => round((float) $p->current_stock * (float) $p->cost_price, 2),
            ]);

        return [
            'items'  => $rows->values(),
            'totals' => [
                'products'    => $rows->count(),
                'total_units' => round($rows->sum('stock'), 3),
                'total_value' => round($rows->sum('value'), 2),
            ],
        ];
    }

    /**
     * Fast / slow / dead classification by outbound movement over a window.
     * dead = no outbound in the window; fast = outbound at or above the average
     * of the movers; slow = some movement below that average.
     */
    public function movement(int|string $companyId, int $days = 30): array
    {
        $since = now()->subDays($days);

        $out = StockLedgerEntry::query()
            ->forCompany($companyId)
            ->where('direction', 'out')
            ->where('occurred_at', '>=', $since)
            ->selectRaw('product_id, SUM(qty) as out_qty, MAX(occurred_at) as last_out')
            ->groupBy('product_id')
            ->get()
            ->keyBy('product_id');

        $movers = $out->where('out_qty', '>', 0);
        $avg = $movers->count() ? (float) $movers->avg('out_qty') : 0.0;

        $rows = Product::query()
            ->forCompany($companyId)
            ->orderBy('name')
            ->get(['id', 'sku', 'name', 'current_stock'])
            ->map(function ($p) use ($out, $avg) {
                $outQty = (float) ($out[$p->id]->out_qty ?? 0);
                $class = $outQty <= 0 ? 'dead' : ($outQty >= $avg ? 'fast' : 'slow');
                return [
                    'id'       => $p->id,
                    'sku'      => $p->sku,
                    'name'     => $p->name,
                    'stock'    => (float) $p->current_stock,
                    'out_qty'  => round($outQty, 3),
                    'last_out' => $out[$p->id]->last_out ?? null,
                    'class'    => $class,
                ];
            });

        return [
            'days'    => $days,
            'items'   => $rows->values(),
            'summary' => [
                'fast' => $rows->where('class', 'fast')->count(),
                'slow' => $rows->where('class', 'slow')->count(),
                'dead' => $rows->where('class', 'dead')->count(),
            ],
        ];
    }
}
