<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
        $company = $request->attributes->get('company');
        $user = $request->user();
        $ok = $user->is_super_admin
            || $user->hasPermission('*', $company->id)
            || $user->hasPermission('activity.view', $company->id);
        abort_unless($ok, 403);

        return $this->ok($this->activity->snapshot($company->id));
    }
}
