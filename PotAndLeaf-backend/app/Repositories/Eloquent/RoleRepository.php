<?php

namespace App\Repositories\Eloquent;

use App\Models\Role;
use App\Repositories\Contracts\RoleRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class RoleRepository implements RoleRepositoryInterface
{
    private const SORTABLE = ['name', 'slug', 'created_at'];

    public function paginateForCompany(int|string $companyId, array $filters): LengthAwarePaginator
    {
        $sort = in_array($filters['sort'] ?? '', self::SORTABLE, true) ? $filters['sort'] : 'name';
        $dir = strtolower($filters['dir'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return Role::query()
            ->withCount('users')
            ->with('permissions:id,name')
            ->forCompany($companyId)
            ->when(filled($filters['search'] ?? null), fn ($q) => $q->where(function ($inner) use ($filters) {
                $inner->where('name', 'like', "%{$filters['search']}%")
                    ->orWhere('slug', 'like', "%{$filters['search']}%");
            }))
            ->orderBy($sort, $dir)
            ->paginate($perPage)
            ->withQueryString();
    }

    public function findForCompany(int|string $companyId, string $id): ?Role
    {
        return Role::query()->with('permissions:id,name')->forCompany($companyId)->whereKey($id)->first();
    }

    public function create(array $data): Role
    {
        return Role::create($data);
    }

    public function update(Role $role, array $data): Role
    {
        $role->update($data);

        return $role->refresh();
    }

    public function delete(Role $role): void
    {
        $role->delete();
    }

    public function restore(int|string $companyId, string $id): ?Role
    {
        $role = Role::onlyTrashed()->forCompany($companyId)->whereKey($id)->first();
        $role?->restore();

        return $role;
    }

    public function slugExists(int|string $companyId, string $slug, ?string $ignoreId = null): bool
    {
        return Role::query()->forCompany($companyId)->where('slug', $slug)
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists();
    }
}
