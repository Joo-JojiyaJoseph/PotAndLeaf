<?php

namespace App\Actions\Suppliers;

use App\Models\Supplier;
use App\Repositories\Contracts\SupplierRepositoryInterface;
use Illuminate\Support\Facades\DB;

class UpdateSupplier
{
    public function __construct(
        private readonly SupplierRepositoryInterface $suppliers,
    ) {}

    /** @param array<string,mixed> $data */
    public function handle(Supplier $supplier, array $data): Supplier
    {
        return DB::transaction(function () use ($supplier, $data) {
            $updated = $this->suppliers->update($supplier, $data);

            // event(new SupplierUpdated($updated));
            // activity()->performedOn($updated)->log('updated');

            return $updated;
        });
    }
}
