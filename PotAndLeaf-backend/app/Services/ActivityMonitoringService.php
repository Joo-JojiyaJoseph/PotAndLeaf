<?php

namespace App\Services;

use App\Models\Location;
use App\Models\ProductionOrder;
use App\Models\Sale;
use App\Models\StockTransfer;
use App\Models\StockVerification;
use App\Models\User;
use Laravel\Sanctum\PersonalAccessToken;

class ActivityMonitoringService
{
    public function snapshot(int|string $companyId): array
    {
        $today = now()->toDateString();

        $branches = Location::forCompany($companyId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(function (Location $loc) use ($companyId, $today) {
                $salesTotal = (float) Sale::forCompany($companyId)
                    ->where('status', 'confirmed')
                    ->where('location_id', $loc->id)
                    ->whereDate('sale_date', $today)
                    ->sum('grand_total');

                $productionCount = ProductionOrder::forCompany($companyId)
                    ->where('status', 'completed')
                    ->where('location_id', $loc->id)
                    ->whereDate('completed_at', $today)
                    ->count();

                $pendingTransfers = StockTransfer::forCompany($companyId)
                    ->whereIn('status', ['draft', 'in_transit'])
                    ->where(fn ($q) => $q->where('from_location_id', $loc->id)->orWhere('to_location_id', $loc->id))
                    ->count();

                return [
                    'location_id'        => $loc->id,
                    'location_name'      => $loc->name,
                    'location_type'      => $loc->type,
                    'today_sales'        => round($salesTotal, 2),
                    'today_production'   => $productionCount,
                    'pending_transfers'  => $pendingTransfers,
                ];
            })
            ->values()
            ->all();

        $pendingApprovals = [
            'stock_verifications' => StockVerification::forCompany($companyId)->where('status', 'submitted')->count(),
        ];

        $recentLogins = PersonalAccessToken::query()
            ->where('tokenable_type', User::class)
            ->where('created_at', '>=', now()->subDays(7))
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(function ($t) use ($companyId) {
                $user = User::find($t->tokenable_id);
                if (! $user || ! $user->companies()->where('companies.id', $companyId)->exists()) {
                    return null;
                }

                return [
                    'user_id'    => $user->id,
                    'user_name'  => $user->name,
                    'logged_at'  => optional($t->created_at)->toDateTimeString(),
                ];
            })
            ->filter()
            ->values()
            ->all();

        return [
            'as_of'             => now()->toDateTimeString(),
            'branches'          => $branches,
            'pending_approvals' => $pendingApprovals,
            'recent_logins'     => $recentLogins,
            'company_totals'    => [
                'today_sales' => round((float) Sale::forCompany($companyId)
                    ->where('status', 'confirmed')->whereDate('sale_date', $today)->sum('grand_total'), 2),
                'today_production' => ProductionOrder::forCompany($companyId)
                    ->where('status', 'completed')->whereDate('completed_at', $today)->count(),
                'in_transit_transfers' => StockTransfer::forCompany($companyId)->where('status', 'in_transit')->count(),
            ],
        ];
    }
}
