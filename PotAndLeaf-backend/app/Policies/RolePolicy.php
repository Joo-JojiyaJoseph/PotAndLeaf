<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\User;

class RolePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('roles.view');
    }

    public function view(User $user, Role $role): bool
    {
        return $user->hasPermission('roles.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('roles.create');
    }

    public function update(User $user, Role $role): bool
    {
        return $user->hasPermission('roles.update');
    }

    public function delete(User $user, Role $role): bool
    {
        return $user->hasPermission('roles.delete') && ! $role->is_system;
    }

    public function restore(User $user, Role $role): bool
    {
        return $user->hasPermission('roles.delete');
    }
}
