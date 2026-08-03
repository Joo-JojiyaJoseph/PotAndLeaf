<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductionOrder;
use App\Models\Purchase;
use App\Models\Rental;
use App\Models\RentalInvoice;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Supplier;
use Illuminate\Support\Carbon;

class ReportService
{
    public function __construct(private readonly InventoryService $inventory) {}

    public function dashboard(int|string $companyId, string $from, string $to): array
    {
        $from = Carbon::parse($from)->toDateString();
        $to = Carbon::parse($to)->toDateString();

        return [
            'range'        => ['from' => $from, 'to' => $to],
            'sales'        => $this->sales($companyId, $from, $to),
            'purchases'    => $this->purchases($companyId, $from, $to),
            'inventory'    => $this->inventorySnapshot($companyId),
            'receivables'  => round((float) Customer::forCompany($companyId)->sum('outstanding'), 2),
            'payables'     => round((float) Supplier::forCompany($companyId)->sum('outstanding'), 2),
            'top_products' => $this->topProducts($companyId, $from, $to),
            'top_customers' => $this->topCustomers($companyId, $from, $to),
            'production'   => $this->production($companyId, $from, $to),
            'rentals'      => $this->rentals($companyId, $from, $to),
        ];
    }

    private function sales(int|string $companyId, string $from, string $to): array
    {
        $base = Sale::forCompany($companyId)->where('status', 'confirmed')->whereBetween('sale_date', [$from, $to]);

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
            'stock_value' => round((float) ($valuation['total'] ?? 0), 2),
            'low_stock'   => $lowStock,
            'skus'        => Product::forCompany($companyId)->count(),
        ];
    }

    private function topProducts(int|string $companyId, string $from, string $to): array
    {
        return SaleItem::query()
            ->whereHas('sale', fn ($q) => $q->forCompany($companyId)->where('status', 'confirmed')->whereBetween('sale_date', [$from, $to]))
            ->selectRaw('product_name, SUM(qty) as qty, SUM(line_total) as revenue')
            ->groupBy('product_name')->orderByDesc('revenue')->limit(5)->get()
            ->map(fn ($r) => ['name' => $r->product_name, 'qty' => round((float) $r->qty, 2), 'revenue' => round((float) $r->revenue, 2)])
            ->all();
    }

    private function topCustomers(int|string $companyId, string $from, string $to): array
    {
        return Sale::forCompany($companyId)->where('status', 'confirmed')->whereBetween('sale_date', [$from, $to])
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
}
