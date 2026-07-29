<?php

namespace App\Repositories\Contracts;

use App\Models\Role;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface RoleRepositoryInterface
{
    /** @param array<string,mixed> $filters */
    public function paginateForCompany(int|string $companyId, array $filters): LengthAwarePaginator;

    public function findForCompany(int|string $companyId, string $id): ?Role;

    /** @param array<string,mixed> $data */
    public function create(array $data): Role;

    /** @param array<string,mixed> $data */
    public function update(Role $role, array $data): Role;

    public function delete(Role $role): void;

    public function restore(int|string $companyId, string $id): ?Role;

    public function slugExists(int|string $companyId, string $slug, ?string $ignoreId = null): bool;
}
