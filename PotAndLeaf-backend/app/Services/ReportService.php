<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductionOrder;
use App\Models\Purchase;
use App\Models\Rental;
use App\Models\RentalInvoice;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Supplier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly SettingsService $settings,
    ) {}

    public function dashboard(int|string $companyId, string $from, string $to, ?string $locationId = null): array
    {
        $from = Carbon::parse($from)->toDateString();
        $to = Carbon::parse($to)->toDateString();

        return [
            'range'         => ['from' => $from, 'to' => $to],
            'location_id'   => $locationId,
            'sales'         => $this->sales($companyId, $from, $to, $locationId),
            'purchases'     => $this->purchases($companyId, $from, $to),
            'inventory'     => $this->inventorySnapshot($companyId),
            'receivables'   => round((float) Customer::forCompany($companyId)->sum('outstanding'), 2),
            'payables'      => round((float) Supplier::forCompany($companyId)->sum('outstanding'), 2),
            'top_products'  => $this->topProducts($companyId, $from, $to, $locationId),
            'top_customers' => $this->topCustomers($companyId, $from, $to, $locationId),
            'production'    => $this->production($companyId, $from, $to),
            'rentals'       => $this->rentals($companyId, $from, $to),
        ];
    }

    /** Product-wise or shop-wise margin (HO cost data). */
    public function marginAnalysis(int|string $companyId, string $from, string $to, string $groupBy = 'product'): array
    {
        $from = Carbon::parse($from)->toDateString();
        $to = Carbon::parse($to)->toDateString();

        if ($groupBy === 'shop') {
            $rows = SaleItem::query()
                ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
                ->leftJoin('products', 'products.id', '=', 'sale_items.product_id')
                ->leftJoin('locations', 'locations.id', '=', 'sales.location_id')
                ->where('sales.company_id', $companyId)
                ->where('sales.status', 'confirmed')
                ->whereBetween('sales.sale_date', [$from, $to])
                ->selectRaw('sales.location_id as group_id, COALESCE(locations.name, ?) as group_name,
                    SUM(sale_items.line_total) as revenue,
                    SUM(sale_items.qty * COALESCE(products.cost_price, 0)) as cogs', ['Unassigned'])
                ->groupBy('sales.location_id', 'locations.name')
                ->get();
        } else {
            $rows = SaleItem::query()
                ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
                ->leftJoin('products', 'products.id', '=', 'sale_items.product_id')
                ->where('sales.company_id', $companyId)
                ->where('sales.status', 'confirmed')
                ->whereBetween('sales.sale_date', [$from, $to])
                ->selectRaw('sale_items.product_id as group_id, COALESCE(sale_items.product_name, products.name, ?) as group_name,
                    SUM(sale_items.line_total) as revenue,
                    SUM(sale_items.qty * COALESCE(products.cost_price, 0)) as cogs', ['Unknown'])
                ->groupBy('sale_items.product_id', 'sale_items.product_name', 'products.name')
                ->get();
        }

        $mapped = $rows->map(function ($r) {
            $revenue = (float) $r->revenue;
            $cogs = (float) $r->cogs;
            $margin = round($revenue - $cogs, 2);
            $pct = $revenue > 0 ? round(($margin / $revenue) * 100, 2) : 0.0;

            return [
                'id'         => $r->group_id,
                'name'       => $r->group_name,
                'revenue'    => round($revenue, 2),
                'cogs'       => round($cogs, 2),
                'margin'     => $margin,
                'margin_pct' => $pct,
            ];
        })->sortByDesc('margin_pct')->values()->all();

        return [
            'group_by' => $groupBy,
            'from'     => $from,
            'to'       => $to,
            'rows'     => $mapped,
        ];
    }

    /**
     * Approximate profit: Sales − COGS − daily expenses.
     */
    public function approximateProfit(
        int|string $companyId,
        string $from,
        string $to,
        string $period = 'daily',
        ?string $branchId = null,
    ): array {
        $fromC = Carbon::parse($from)->startOfDay();
        $toC = Carbon::parse($to)->endOfDay();
        $dailyExpense = $this->settings->getFloat($companyId, 'daily_expense');

        $salesQ = Sale::forCompany($companyId)
            ->where('status', 'confirmed')
            ->whereBetween('sale_date', [$fromC->toDateString(), $toC->toDateString()])
            ->when($branchId, fn ($q) => $q->where('location_id', $branchId));

        $salesTotal = (float) (clone $salesQ)->sum('grand_total');

        $cogs = (float) SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->leftJoin('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.company_id', $companyId)
            ->where('sales.status', 'confirmed')
            ->whereBetween('sales.sale_date', [$fromC->toDateString(), $toC->toDateString()])
            ->when($branchId, fn ($q) => $q->where('sales.location_id', $branchId))
            ->sum(DB::raw('sale_items.qty * COALESCE(products.cost_price, 0)'));

        $days = max(1, (int) $fromC->diffInDays($toC) + 1);
        $expenses = round($dailyExpense * $days, 2);
        $profit = round($salesTotal - $cogs - $expenses, 2);

        $bucketExpr = match ($period) {
            'weekly'  => 'YEARWEEK(sale_date, 1)',
            'monthly' => "DATE_FORMAT(sale_date, '%Y-%m')",
            'yearly'  => 'YEAR(sale_date)',
            default   => 'DATE(sale_date)',
        };

        $trend = Sale::forCompany($companyId)
            ->where('status', 'confirmed')
            ->whereBetween('sale_date', [$fromC->toDateString(), $toC->toDateString()])
            ->when($branchId, fn ($q) => $q->where('location_id', $branchId))
            ->selectRaw("{$bucketExpr} as bucket, SUM(grand_total) as sales")
            ->groupBy(DB::raw($bucketExpr))
            ->orderBy('bucket')
            ->get()
            ->map(fn ($r) => [
                'period' => (string) $r->bucket,
                'sales'  => round((float) $r->sales, 2),
            ])
            ->all();

        $byBranch = Location::forCompany($companyId)
            ->orderBy('name')
            ->get()
            ->map(function (Location $loc) use ($companyId, $fromC, $toC, $dailyExpense, $days) {
                $sales = (float) Sale::forCompany($companyId)
                    ->where('status', 'confirmed')
                    ->where('location_id', $loc->id)
                    ->whereBetween('sale_date', [$fromC->toDateString(), $toC->toDateString()])
                    ->sum('grand_total');
                $branchCogs = (float) SaleItem::query()
                    ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
                    ->leftJoin('products', 'products.id', '=', 'sale_items.product_id')
                    ->where('sales.company_id', $companyId)
                    ->where('sales.status', 'confirmed')
                    ->where('sales.location_id', $loc->id)
                    ->whereBetween('sales.sale_date', [$fromC->toDateString(), $toC->toDateString()])
                    ->sum(DB::raw('sale_items.qty * COALESCE(products.cost_price, 0)'));
                $exp = round($dailyExpense * $days, 2);

                return [
                    'location_id'   => $loc->id,
                    'location_name' => $loc->name,
                    'sales'         => round($sales, 2),
                    'cogs'          => round($branchCogs, 2),
                    'expenses'      => $exp,
                    'profit'        => round($sales - $branchCogs - $exp, 2),
                ];
            })
            ->filter(fn ($r) => $r['sales'] > 0 || $r['cogs'] > 0)
            ->values()
            ->all();

        return [
            'from'      => $fromC->toDateString(),
            'to'        => $toC->toDateString(),
            'period'    => $period,
            'branch_id' => $branchId,
            'aggregate' => [
                'sales'    => round($salesTotal, 2),
                'cogs'     => round($cogs, 2),
                'expenses' => $expenses,
                'profit'   => $profit,
                'days'     => $days,
            ],
            'trend'     => $trend,
            'by_branch' => $byBranch,
        ];
    }

    private function sales(int|string $companyId, string $from, string $to, ?string $locationId = null): array
    {
        $base = Sale::forCompany($companyId)->where('status', 'confirmed')->whereBetween('sale_date', [$from, $to])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId));

        $byMode = (clone $base)->selectRaw('payment_mode, SUM(grand_total) as total')
            ->groupBy('payment_mode')->pluck('total', 'payment_mode')
            ->map(fn ($v) => round((float) $v, 2));

        $trend = (clone $base)->selectRaw('sale_date as d, SUM(grand_total) as total')
            ->groupBy('sale_date')->orderBy('sale_date')->get()
            ->map(fn ($r) => ['date' => Carbon::parse($r->d)->toDateString(), 'total' => round((float) $r->total, 2)]);

        return [
            'total'   => round((float) (clone $base)->sum('grand_total'), 2),
            'count'   => (clone $base)->count(),
            'by_mode' => $byMode,
            'trend'   => $trend,
        ];
    }

    private function purchases(int|string $companyId, string $from, string $to): array
    {
        $base = Purchase::forCompany($companyId)->where('status', 'confirmed')->whereBetween('purchase_date', [$from, $to]);

        return ['total' => round((float) (clone $base)->sum('grand_total'), 2), 'count' => (clone $base)->count()];
    }

    private function inventorySnapshot(int|string $companyId): array
    {
        $valuation = $this->inventory->valuation($companyId);
        $lowStock = Product::forCompany($companyId)
            ->whereColumn('current_stock', '<=', 'reorder_level')
            ->where('reorder_level', '>', 0)->count();

        return [
            'stock_value' => round((float) ($valuation['totals']['total_value'] ?? $valuation['total'] ?? 0), 2),
            'low_stock'   => $lowStock,
            'skus'        => Product::forCompany($companyId)->count(),
        ];
    }

    private function topProducts(int|string $companyId, string $from, string $to, ?string $locationId = null): array
    {
        return SaleItem::query()
            ->whereHas('sale', fn ($q) => $q->forCompany($companyId)->where('status', 'confirmed')
                ->whereBetween('sale_date', [$from, $to])
                ->when($locationId, fn ($qq) => $qq->where('location_id', $locationId)))
            ->selectRaw('product_name, SUM(qty) as qty, SUM(line_total) as revenue')
            ->groupBy('product_name')->orderByDesc('revenue')->limit(5)->get()
            ->map(fn ($r) => ['name' => $r->product_name, 'qty' => round((float) $r->qty, 2), 'revenue' => round((float) $r->revenue, 2)])
            ->all();
    }

    private function topCustomers(int|string $companyId, string $from, string $to, ?string $locationId = null): array
    {
        return Sale::forCompany($companyId)->where('status', 'confirmed')->whereBetween('sale_date', [$from, $to])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->selectRaw('customer_name, SUM(grand_total) as revenue')
            ->groupBy('customer_name')->orderByDesc('revenue')->limit(5)->get()
            ->map(fn ($r) => ['name' => $r->customer_name, 'revenue' => round((float) $r->revenue, 2)])
            ->all();
    }

    private function production(int|string $companyId, string $from, string $to): array
    {
        $base = ProductionOrder::forCompany($companyId)->where('status', 'completed')->whereBetween('order_date', [$from, $to]);

        return [
            'completed'    => (clone $base)->count(),
            'output_value' => round((float) (clone $base)->sum('total_input_cost'), 2),
        ];
    }

    private function rentals(int|string $companyId, string $from, string $to): array
    {
        return [
            'active'   => Rental::forCompany($companyId)->where('status', 'active')->count(),
            'invoiced' => round((float) RentalInvoice::forCompany($companyId)->whereBetween('period_from', [$from, $to])->sum('amount'), 2),
        ];
    }

    /** Revenue breakdown by price tier used at POS (retail / wholesale / dealer). */
    public function salesByPriceLevel(int|string $companyId, string $from, string $to): array
    {
        $from = Carbon::parse($from)->toDateString();
        $to = Carbon::parse($to)->toDateString();

        $rows = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.company_id', $companyId)
            ->where('sales.status', 'confirmed')
            ->whereBetween('sales.sale_date', [$from, $to])
            ->selectRaw("COALESCE(sale_items.price_level, 'retail') as price_level,
                COUNT(DISTINCT sales.id) as sale_count,
                SUM(sale_items.qty) as qty,
                SUM(sale_items.line_total) as revenue")
            ->groupBy('price_level')
            ->orderByDesc('revenue')
            ->get()
            ->map(fn ($r) => [
                'price_level' => $r->price_level,
                'label'       => match ($r->price_level) {
                    'wholesale' => 'Wholesale',
                    'dealer'    => 'Dealer / Landscaper',
                    default     => 'Retail',
                },
                'sale_count'  => (int) $r->sale_count,
                'qty'         => round((float) $r->qty, 3),
                'revenue'     => round((float) $r->revenue, 2),
            ])
            ->values()
            ->all();

        $total = round(collect($rows)->sum('revenue'), 2);

        return [
            'range'   => ['from' => $from, 'to' => $to],
            'rows'    => $rows,
            'total'   => $total,
        ];
    }
}
