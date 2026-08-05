<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Services\ActivityMonitoringService;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityMonitoringController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly ActivityMonitoringService $activity) {}

    public function index(Request $request): JsonResponse
    {
        $company = $this->resolveCompany($request);
        $user = $request->user();
        $ok = $user->is_super_admin
            || $user->hasPermission('*', $request->attributes->get('company')->id)
            || $user->hasPermission('activity.view', $request->attributes->get('company')->id);
        abort_unless($ok, 403);

        return $this->ok($this->activity->snapshot($company->id));
    }

    public function formData(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->is_super_admin, 403);

        $companies = Company::active()->orderBy('name')->get(['id', 'name', 'code']);

        return $this->ok(['companies' => $companies]);
    }

    private function resolveCompany(Request $request): Company
    {
        $current = $request->attributes->get('company');
        if ($request->user()->is_super_admin && $request->filled('company_id')) {
            return Company::findOrFail((int) $request->query('company_id'));
        }

        return $current;
    }
}
