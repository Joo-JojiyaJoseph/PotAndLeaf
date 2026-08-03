<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds the branch roles from the access-control design (besides the protected
 * Administrator role). Permissions are selected by module prefix so the roles
 * stay correct as new module permissions are added to the registry.
 */
class StandardRolesSeeder extends Seeder
{
    public function run(): void
    {
        $all = Permission::pluck('id', 'name'); // name => id

        $roles = [
            'Manager'      => ['suppliers.', 'products.', 'purchases.', 'inventory.', 'purchase_returns.', 'stock_verifications.', 'bulk_splits.', 'sales.', 'customers.', 'payments.', 'receipts.', 'commission.', 'transfers.', 'locations.', 'production.', 'rental.', 'reports.', 'po.', 'advance.', 'users.view', 'roles.view'],
            'Cashier'      => ['products.view', 'inventory.view', 'sales.view', 'sales.create', 'sales.confirm', 'customers.view', 'customers.create', 'receipts.view', 'receipts.create'],
            'Godown Staff' => ['inventory.', 'stock_verifications.', 'transfers.', 'locations.view', 'products.view', 'purchases.view'],
            'Supervisor'   => ['products.view', 'inventory.view', 'stock_verifications.view'],
            'Salesman'     => ['products.view', 'inventory.view', 'sales.view', 'sales.create', 'customers.view', 'customers.create'],
        ];

        Company::all()->each(function (Company $company) use ($roles, $all) {
            foreach ($roles as $name => $prefixes) {
                $role = Role::firstOrCreate(
                    ['company_id' => $company->id, 'slug' => Str::slug($name)],
                    ['name' => $name, 'is_system' => false],
                );

                $ids = $all->filter(function ($id, $permName) use ($prefixes) {
                    foreach ($prefixes as $p) {
                        if (str_ends_with($p, '.') ? str_starts_with($permName, $p) : $permName === $p) {
                            return true;
                        }
                    }
                    return false;
                })->values()->all();

                $role->permissions()->sync($ids);
            }
        });
    }
}
