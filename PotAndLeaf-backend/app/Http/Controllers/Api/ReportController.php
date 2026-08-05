<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Services\ReportExportService;
use App\Services\ReportService;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly ReportService $reports,
        private readonly ReportExportService $export,
    ) {}

    public function dashboard(Request $request): JsonResponse
    {
        $this->allow($request, 'reports.view');
        $companyId = $this->reportCompanyId($request);
        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();

        return $this->ok($this->reports->dashboard($companyId, $from, $to, null));
    }

    public function formData(Request $request): JsonResponse
    {
        $this->allow($request, 'reports.view');
        $user = $request->user();

        $companies = $user->is_super_admin
            ? Company::active()->orderBy('name')->get(['id', 'name', 'code'])
            : collect([$this->company($request)->only(['id', 'name', 'code'])]);

        return $this->ok(['companies' => $companies]);
    }

    public function margin(Request $request): JsonResponse
    {
        $this->allowHo($request);
        $companyId = $this->reportCompanyId($request);
        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();

        return $this->ok($this->reports->marginAnalysis($companyId, $from, $to, 'product'));
    }

    public function profit(Request $request): JsonResponse
    {
        $this->allowHo($request);
        $companyId = $this->reportCompanyId($request);
        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();
        $period = $request->query('period', 'daily');
        if (! in_array($period, ['daily', 'weekly', 'monthly', 'yearly'], true)) {
            $period = 'daily';
        }

        return $this->ok($this->reports->approximateProfit($companyId, $from, $to, $period, null));
    }

    public function priceLevels(Request $request): JsonResponse
    {
        $this->allow($request, 'reports.view');
        $companyId = $this->reportCompanyId($request);
        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();

        return $this->ok($this->reports->salesByPriceLevel($companyId, $from, $to));
    }

    public function exportDashboard(Request $request)
    {
        $this->allow($request, 'reports.view');
        $companyId = $this->reportCompanyId($request);
        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();
        $format = $request->query('format', 'pdf');

        $data = $this->reports->dashboard($companyId, $from, $to, null);
        $rows = collect($data['top_products'])->map(fn ($r) => [
            'name' => $r['name'], 'qty' => $r['qty'], 'revenue' => $r['revenue'],
        ]);
        $headers = ['name', 'qty', 'revenue'];
        $labels = ['name' => 'Product', 'qty' => 'Qty', 'revenue' => 'Revenue'];
        $meta = ['From' => $from, 'To' => $to, 'Sales total' => $data['sales']['total']];

        if ($format === 'excel') {
            return $this->export->excelCsv("dashboard-{$from}-{$to}.csv", $rows, $headers, $labels);
        }

        return $this->export->pdf('Dashboard — Top products', $rows, $headers, $labels, $meta)
            ->download("dashboard-{$from}-{$to}.pdf");
    }

    public function exportMargin(Request $request)
    {
        $this->allowHo($request);
        $companyId = $this->reportCompanyId($request);
        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();
        $format = $request->query('format', 'pdf');

        $data = $this->reports->marginAnalysis($companyId, $from, $to, 'product');
        $headers = ['name', 'revenue', 'cogs', 'margin', 'margin_pct'];
        $labels = [
            'name' => 'Product', 'revenue' => 'Revenue', 'cogs' => 'COGS', 'margin' => 'Margin', 'margin_pct' => 'Margin %',
        ];

        if ($format === 'excel') {
            return $this->export->excelCsv("margin-{$from}-{$to}.csv", $data['rows'], $headers, $labels);
        }

        return $this->export->pdf('Profit & Margin', $data['rows'], $headers, $labels, [
            'From' => $from, 'To' => $to,
        ])->download("margin-{$from}-{$to}.pdf");
    }

    public function exportProfit(Request $request)
    {
        $this->allowHo($request);
        $companyId = $this->reportCompanyId($request);
        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();
        $period = $request->query('period', 'daily');
        $format = $request->query('format', 'pdf');

        $data = $this->reports->approximateProfit($companyId, $from, $to, $period, null);
        $headers = ['location_name', 'sales', 'cogs', 'expenses', 'profit'];
        $labels = [
            'location_name' => 'Company', 'sales' => 'Sales', 'cogs' => 'COGS',
            'expenses' => 'Expenses', 'profit' => 'Profit',
        ];

        if ($format === 'excel') {
            return $this->export->excelCsv("profit-{$from}-{$to}.csv", $data['by_branch'], $headers, $labels);
        }

        return $this->export->pdf('Approximate Profit', $data['by_branch'], $headers, $labels, [
            'From' => $from, 'To' => $to,
            'Aggregate profit' => $data['aggregate']['profit'],
        ])->download("profit-{$from}-{$to}.pdf");
    }

    private function reportCompanyId(Request $request): int|string
    {
        if ($request->user()->is_super_admin && $request->filled('company_id')) {
            return (int) $request->query('company_id');
        }

        return $this->company($request)->id;
    }

    private function company(Request $request)
    {
        return $request->attributes->get('company');
    }

    private function allow(Request $request, string $permission): void
    {
        abort_unless($request->user()->hasPermission($permission, $this->company($request)->id), 403);
    }

    private function allowHo(Request $request): void
    {
        $company = $this->company($request);
        $user = $request->user();
        $ok = $user->is_super_admin
            || $user->hasPermission('*', $company->id)
            || $user->hasPermission('reports.margin', $company->id)
            || $user->hasPermission('reports.profit', $company->id)
            || $user->hasPermission('products.view_cost', $company->id);
        abort_unless($ok, 403);
    }
}
