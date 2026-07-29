<?php

namespace App\Actions\Suppliers;

use App\Models\Supplier;
use App\Repositories\Contracts\SupplierRepositoryInterface;
use Illuminate\Support\Facades\DB;

/**
 * One write use-case = one action. Actions own the transaction boundary
 * and side effects (events, notifications, activity log). Reuse them from
 * controllers, jobs, console commands, or tests — anywhere.
 */
class CreateSupplier
{
    public function __construct(
        private readonly SupplierRepositoryInterface $suppliers,
    ) {}

    /** @param array<string,mixed> $data */
    public function handle(int|string $companyId, array $data): Supplier
    {
        return DB::transaction(function () use ($companyId, $data) {
            $supplier = $this->suppliers->create([
                ...$data,
                'company_id' => $companyId,
                'outstanding' => $data['opening_balance'] ?? 0,
            ]);

            // Side effects live here, e.g.:
            // event(new SupplierCreated($supplier));
            // activity()->performedOn($supplier)->log('created');

            return $supplier;
        });
    }
}
