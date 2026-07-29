<?php

namespace App\Providers;

use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Repositories\Contracts\PurchaseRepositoryInterface;
use App\Repositories\Contracts\PurchaseReturnRepositoryInterface;
use App\Repositories\Contracts\RoleRepositoryInterface;
use App\Repositories\Contracts\StockVerificationRepositoryInterface;
use App\Repositories\Contracts\SupplierRepositoryInterface;
use App\Repositories\Eloquent\ProductRepository;
use App\Repositories\Eloquent\PurchaseRepository;
use App\Repositories\Eloquent\PurchaseReturnRepository;
use App\Repositories\Eloquent\RoleRepository;
use App\Repositories\Eloquent\StockVerificationRepository;
use App\Repositories\Eloquent\SupplierRepository;
use Illuminate\Support\ServiceProvider;

/**
 * Binds each repository contract to its Eloquent implementation. Add one line
 * per rich module. (Simple lookup masters use App\Support\Lookup\LookupRepository
 * directly and need no binding here.) Register this provider in bootstrap/providers.php.
 */
class RepositoryServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    public array $bindings = [
        SupplierRepositoryInterface::class => SupplierRepository::class,
        ProductRepositoryInterface::class  => ProductRepository::class,
        PurchaseRepositoryInterface::class => PurchaseRepository::class,
        PurchaseReturnRepositoryInterface::class => PurchaseReturnRepository::class,
        StockVerificationRepositoryInterface::class => StockVerificationRepository::class,
        RoleRepositoryInterface::class     => RoleRepository::class,
    ];
}
