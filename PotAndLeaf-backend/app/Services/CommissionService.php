<?php

namespace App\Services;

use App\Models\CommissionPayout;
use App\Models\CommissionRule;
use App\Models\Sale;
use Illuminate\Support\Carbon;

class CommissionService
{
    public function rules(int|string $companyId)
    {
        return CommissionRule::forCompany($companyId)->with('user:id,name')->get();
    }

    public function upsertRule(int|string $companyId, array $data): CommissionRule
    {
        return CommissionRule::updateOrCreate(
            ['company_id' => $companyId, 'user_id' => $data['user_id']],
            [
                'base_percent'   => $data['base_percent'] ?? 0,
                'monthly_target' => $data['monthly_target'] ?? 0,
                'target_bonus'   => $data['target_bonus'] ?? 0,
                'notes'          => $data['notes'] ?? null,
                'is_active'      => $data['is_active'] ?? true,
            ],
        )->load('user:id,name');
    }

    /** Compute commission for a staff member in a YYYY-MM period from confirmed sales they billed. */
    public function compute(int|string $companyId, int $userId, string $period): array
    {
        [$year, $month] = array_map('intval', explode('-', $period));

        $salesTotal = (float) Sale::forCompany($companyId)
            ->where('created_by', $userId)
            ->where('status', 'confirmed')
            ->whereYear('sale_date', $year)
            ->whereMonth('sale_date', $month)
            ->sum('grand_total');

        $rule = CommissionRule::forCompany($companyId)->where('user_id', $userId)->first();
        $basePercent = (float) ($rule->base_percent ?? 0);
        $target = (float) ($rule->monthly_target ?? 0);
        $bonusRule = (float) ($rule->target_bonus ?? 0);

        $base = round($salesTotal * $basePercent / 100, 2);
        $targetMet = $target > 0 && $salesTotal >= $target;
        $bonus = $targetMet ? $bonusRule : 0.0;

        return [
            'user_id'      => $userId,
            'period'       => $period,
            'sales_total'  => round($salesTotal, 2),
            'base_percent' => $basePercent,
            'base_amount'  => $base,
            'target'       => $target,
            'target_met'   => $targetMet,
            'bonus'        => $bonus,
            'commission'   => round($base + $bonus, 2),
            'has_rule'     => (bool) $rule,
        ];
    }

    public function payouts(int|string $companyId)
    {
        return CommissionPayout::forCompany($companyId)
            ->with('user:id,name')
            ->orderByDesc('period')
            ->orderByDesc('created_at')
            ->paginate(30);
    }

    public function recordPayout(int|string $companyId, array $data): CommissionPayout
    {
        return CommissionPayout::updateOrCreate(
            ['company_id' => $companyId, 'user_id' => $data['user_id'], 'period' => $data['period']],
            [
                'sales_total'  => $data['sales_total'] ?? 0,
                'amount'       => $data['amount'],
                'mode'         => $data['mode'] ?? 'cash',
                'payment_date' => $data['payment_date'] ?? null,
                'reference'    => $data['reference'] ?? null,
                'notes'        => $data['notes'] ?? null,
                'status'       => $data['status'] ?? 'paid',
            ],
        )->load('user:id,name');
    }

    public function deletePayout(CommissionPayout $payout): void
    {
        $payout->delete();
    }
}
