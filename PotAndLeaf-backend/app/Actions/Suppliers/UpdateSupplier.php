<?php

namespace App\Actions\Suppliers;

use App\Models\Supplier;
use App\Repositories\Contracts\SupplierRepositoryInterface;
use App\Support\Media\MediaStorage;
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
            if (array_key_exists('photo', $data)) {
                $data['photo'] = MediaStorage::replace($supplier->photo, $data['photo']);
            }

            return $this->suppliers->update($supplier, $data);
        });
    }
}
