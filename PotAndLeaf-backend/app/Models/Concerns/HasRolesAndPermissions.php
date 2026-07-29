<?php

namespace App\Models\Concerns;

use App\Models\Role;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Collection;

/**
 * Company-scoped RBAC for the User model. A user's roles live under a company;
 * permission checks resolve against a company id (passed explicitly by the API,
 * which knows the active company from the X-Company-Id header). Wildcards are
 * supported — "*" grants everything, "products.*" grants a whole module.
 */
trait HasRolesAndPermissions
{
    /** Per-request memo of permission names keyed by company id. */
    protected array $permissionCache = [];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_user')->withTimestamps();
    }

    public function hasPermission(string $permission, int|string|null $companyId = null): bool
    {
        $companyId ??= $this->defaultCompany()?->id;

        if ($companyId === null) {
            return false;
        }

        $names = $this->permissionNamesForCompany($companyId);

        if ($names->contains('*')) {
            return true;
        }

        $module = explode('.', $permission)[0];

        return $names->contains($permission) || $names->contains("{$module}.*");
    }

    /** @param array<int,string> $permissions */
    public function hasAnyPermission(array $permissions, int|string|null $companyId = null): bool
    {
        foreach ($permissions as $permission) {
            if ($this->hasPermission($permission, $companyId)) {
                return true;
            }
        }

        return false;
    }

    public function hasRole(string $slug, int|string|null $companyId = null): bool
    {
        return $this->roles()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('slug', $slug)
            ->exists();
    }

    /** Distinct permission names granted to this user within a company. */
    public function permissionNamesForCompany(int|string $companyId): Collection
    {
        return $this->permissionCache[$companyId] ??= Role::query()
            ->where('company_id', $companyId)
            ->whereHas('users', fn ($q) => $q->whereKey($this->getKey()))
            ->with('permissions:id,name')
            ->get()
            ->flatMap(fn (Role $role) => $role->permissions->pluck('name'))
            ->unique()
            ->values();
    }
}
