<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Seeds a couple of real branch logins per company (a Manager and a Cashier),
 * each attached to that company with the matching role — so the Users screen
 * has data and per-company logins can be tested. Password: "password".
 */
class BranchUserSeeder extends Seeder
{
    public function run(): void
    {
        $people = [
            ['name' => 'Branch Manager', 'role' => 'Manager', 'prefix' => 'manager'],
            ['name' => 'Shop Cashier',   'role' => 'Cashier', 'prefix' => 'cashier'],
        ];

        Company::all()->each(function (Company $company) use ($people) {
            $slug = Str::lower($company->code);
            foreach ($people as $p) {
                $user = User::firstOrCreate(
                    ['email' => "{$p['prefix']}.{$slug}@potandleaf.test"],
                    ['name' => "{$p['name']} ({$company->code})", 'password' => Hash::make('password'), 'is_active' => true],
                );
                $user->companies()->syncWithoutDetaching([$company->id => ['is_default' => true]]);

                $role = Role::forCompany($company->id)->where('slug', Str::slug($p['role']))->first();
                if ($role) {
                    // Ensure exactly this company's role is attached.
                    $companyRoleIds = Role::forCompany($company->id)->pluck('id')->all();
                    $user->roles()->detach($companyRoleIds);
                    $user->roles()->syncWithoutDetaching([$role->id]);
                }
            }
        });
    }
}
