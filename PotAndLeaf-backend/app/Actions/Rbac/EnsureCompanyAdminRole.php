<?php

namespace App\Actions\Rbac;

use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Guarantees a company has a protected "Administrator" role holding full access
 * ("*"), and optionally assigns it to a user. Idempotent — safe to re-run.
 */
class EnsureCompanyAdminRole
{
    public function handle(Company $company, ?User $assignTo = null): Role
    {
        return DB::transaction(function () use ($company, $assignTo) {
            $role = Role::withTrashed()->firstOrCreate(
                ['company_id' => $company->id, 'slug' => 'administrator'],
                ['name' => 'Administrator', 'description' => 'Full access to every module.', 'is_system' => true],
            );

            if ($role->trashed()) {
                $role->restore();
            }

            $wildcard = Permission::where('name', '*')->first();
            if ($wildcard) {
                $role->permissions()->syncWithoutDetaching([$wildcard->id]);
            }

            if ($assignTo) {
                $role->users()->syncWithoutDetaching([$assignTo->id]);
            }

            return $role;
        });
    }
}
