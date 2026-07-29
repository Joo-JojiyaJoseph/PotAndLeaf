<?php

namespace App\Support\Rbac;

/**
 * The single source of truth for every permission in the app. Seed it into the
 * permissions table with PermissionSeeder; the Role matrix renders straight
 * from groups(). Add a line here when you add a capability — never hand-type
 * permission strings elsewhere.
 */
class PermissionRegistry
{
    /**
     * module => [ permission name => human label ]
     *
     * @return array<string, array<string,string>>
     */
    public static function groups(): array
    {
        $crud = fn (string $mod, string $label) => [
            "{$mod}.view"   => "View {$label}",
            "{$mod}.create" => "Create {$label}",
            "{$mod}.update" => "Edit {$label}",
            "{$mod}.delete" => "Delete {$label}",
        ];

        return [
            'System'     => ['*' => 'Full access (all modules)'],
            'Suppliers'  => $crud('suppliers', 'suppliers') + ['suppliers.force-delete' => 'Permanently delete suppliers'],
            'Products'   => $crud('products', 'products') + ['products.force-delete' => 'Permanently delete products'],
            'Purchases'  => $crud('purchases', 'purchases') + ['purchases.confirm' => 'Confirm purchases'],
            'Purchase Returns' => [
                'purchase_returns.view'    => 'View purchase returns',
                'purchase_returns.create'  => 'Create purchase returns',
                'purchase_returns.confirm' => 'Confirm purchase returns',
                'purchase_returns.delete'  => 'Cancel purchase returns',
            ],
            'Inventory'  => ['inventory.view' => 'View inventory, ledger & reports'],
            'Bulk Splitting' => [
                'bulk_splits.view'    => 'View bulk splits',
                'bulk_splits.create'  => 'Create bulk splits',
                'bulk_splits.confirm' => 'Confirm bulk splits',
                'bulk_splits.delete'  => 'Cancel bulk splits',
            ],
            'Stock Verification' => [
                'stock_verifications.view'    => 'View stock counts',
                'stock_verifications.create'  => 'Create & submit stock counts',
                'stock_verifications.approve' => 'Approve or reject stock counts (HO)',
            ],
            'Categories' => $crud('categories', 'categories'),
            'Brands'     => $crud('brands', 'brands'),
            'Units'      => $crud('units', 'units'),
            'Roles'      => $crud('roles', 'roles'),
            'Users'      => [
                'users.view'   => 'View users',
                'users.create' => 'Create users',
                'users.update' => 'Edit users',
                'users.delete' => 'Remove users',
            ],
        ];
    }

    /**
     * Flattened catalog for seeding.
     *
     * @return array<int, array{name:string, module:string, label:string}>
     */
    public static function flat(): array
    {
        $rows = [];
        foreach (self::groups() as $module => $permissions) {
            foreach ($permissions as $name => $label) {
                $rows[] = ['name' => $name, 'module' => $module, 'label' => $label];
            }
        }

        return $rows;
    }
}
