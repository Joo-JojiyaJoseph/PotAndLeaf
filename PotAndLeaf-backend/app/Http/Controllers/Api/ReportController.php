<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly ReportService $reports) {}

    public function dashboard(Request $request): JsonResponse
    {
        $company = $request->attributes->get('company');
        abort_unless($request->user()->hasPermission('reports.view', $company->id), 403);

        $from = $request->query('from') ?: now()->subDays(29)->toDateString();
        $to = $request->query('to') ?: now()->toDateString();

        return $this->ok($this->reports->dashboard($company->id, $from, $to));
    }
}
