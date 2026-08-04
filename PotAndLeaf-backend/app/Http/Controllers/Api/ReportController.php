<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;
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
        $company = $this->company($request);
        $this->allow($request, 'reports.view');

        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();
        $locationId = $request->query('location_id') ?: null;

        return $this->ok($this->reports->dashboard($company->id, $from, $to, $locationId));
    }

    public function formData(Request $request): JsonResponse
    {
        $company = $this->company($request);
        $this->allow($request, 'reports.view');

        return $this->ok([
            'locations' => Location::forCompany($company->id)->where('is_active', true)
                ->orderBy('name')->get(['id', 'name', 'type']),
        ]);
    }

    public function margin(Request $request): JsonResponse
    {
        $company = $this->company($request);
        $this->allowHo($request);

        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();
        $groupBy = $request->query('group_by') === 'shop' ? 'shop' : 'product';

        return $this->ok($this->reports->marginAnalysis($company->id, $from, $to, $groupBy));
    }

    public function profit(Request $request): JsonResponse
    {
        $company = $this->company($request);
        $this->allowHo($request);

        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();
        $period = $request->query('period', 'daily');
        if (! in_array($period, ['daily', 'weekly', 'monthly', 'yearly'], true)) {
            $period = 'daily';
        }
        $branchId = $request->query('branch_id') ?: null;

        return $this->ok($this->reports->approximateProfit($company->id, $from, $to, $period, $branchId));
    }

    public function exportDashboard(Request $request)
    {
        $company = $this->company($request);
        $this->allow($request, 'reports.view');

        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();
        $locationId = $request->query('location_id') ?: null;
        $format = $request->query('format', 'pdf');

        $data = $this->reports->dashboard($company->id, $from, $to, $locationId);
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
        $company = $this->company($request);
        $this->allowHo($request);

        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();
        $groupBy = $request->query('group_by') === 'shop' ? 'shop' : 'product';
        $format = $request->query('format', 'pdf');

        $data = $this->reports->marginAnalysis($company->id, $from, $to, $groupBy);
        $headers = ['name', 'revenue', 'cogs', 'margin', 'margin_pct'];
        $labels = [
            'name' => $groupBy === 'shop' ? 'Shop' : 'Product',
            'revenue' => 'Revenue', 'cogs' => 'COGS', 'margin' => 'Margin', 'margin_pct' => 'Margin %',
        ];

        if ($format === 'excel') {
            return $this->export->excelCsv("margin-{$groupBy}-{$from}-{$to}.csv", $data['rows'], $headers, $labels);
        }

        return $this->export->pdf('Profit & Margin — '.ucfirst($groupBy), $data['rows'], $headers, $labels, [
            'From' => $from, 'To' => $to,
        ])->download("margin-{$groupBy}-{$from}-{$to}.pdf");
    }

    public function exportProfit(Request $request)
    {
        $company = $this->company($request);
        $this->allowHo($request);

        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();
        $period = $request->query('period', 'daily');
        $branchId = $request->query('branch_id') ?: null;
        $format = $request->query('format', 'pdf');

        $data = $this->reports->approximateProfit($company->id, $from, $to, $period, $branchId);
        $headers = ['location_name', 'sales', 'cogs', 'expenses', 'profit'];
        $labels = [
            'location_name' => 'Branch', 'sales' => 'Sales', 'cogs' => 'COGS',
            'expenses' => 'Expenses', 'profit' => 'Profit',
        ];

        if ($format === 'excel') {
            return $this->export->excelCsv("profit-{$from}-{$to}.csv", $data['by_branch'], $headers, $labels);
        }

        return $this->export->pdf('Approximate Profit by Branch', $data['by_branch'], $headers, $labels, [
            'From' => $from, 'To' => $to,
            'Aggregate profit' => $data['aggregate']['profit'],
        ])->download("profit-{$from}-{$to}.pdf");
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
