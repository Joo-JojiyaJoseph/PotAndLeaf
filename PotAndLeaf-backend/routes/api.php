<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BulkSplitController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\PurchaseReturnController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\StockVerificationController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Middleware\ResolveApiCompany;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API routes (decoupled React SPA — Sanctum token auth)
|--------------------------------------------------------------------------
| Register in bootstrap/app.php:
|   ->withRouting(
|       web: __DIR__.'/../routes/web.php',
|       api: __DIR__.'/../routes/api.php',
|       commands: __DIR__.'/../routes/console.php',
|   )
| Company-scoped routes require an "X-Company-Id" header (see ResolveApiCompany).
*/

// Public
Route::post('login', [AuthController::class, 'login']);

// Authenticated (any company)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);

    // Company management (HO super admin only — not company-scoped)
    Route::get('companies', [CompanyController::class, 'index']);
    Route::post('companies', [CompanyController::class, 'store']);
    Route::get('companies/{company}', [CompanyController::class, 'show']);
    Route::put('companies/{company}', [CompanyController::class, 'update']);
    Route::delete('companies/{company}', [CompanyController::class, 'destroy']);

    // Company-scoped
    Route::middleware(ResolveApiCompany::class)->group(function () {
        Route::get('permissions', [AuthController::class, 'permissions']);
        Route::get('dashboard', [DashboardController::class, 'index']);

        Route::get('suppliers', [SupplierController::class, 'index']);
        Route::post('suppliers', [SupplierController::class, 'store']);
        Route::get('suppliers/{supplier}', [SupplierController::class, 'show']);
        Route::put('suppliers/{supplier}', [SupplierController::class, 'update']);
        Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy']);

        // Products master (CRUD)
        Route::get('products/form-data', [ProductController::class, 'formData']);
        Route::get('products', [ProductController::class, 'index']);
        Route::post('products', [ProductController::class, 'store']);
        Route::get('products/{product}', [ProductController::class, 'show']);
        Route::put('products/{product}', [ProductController::class, 'update']);
        Route::delete('products/{product}', [ProductController::class, 'destroy']);

        // Milestone 2 — Procurement
        Route::get('purchases/form-data', [PurchaseController::class, 'formData']);
        Route::get('purchases', [PurchaseController::class, 'index']);
        Route::post('purchases', [PurchaseController::class, 'store']);
        Route::get('purchases/{purchase}', [PurchaseController::class, 'show']);
        Route::put('purchases/{purchase}', [PurchaseController::class, 'update']);
        Route::post('purchases/{purchase}/confirm', [PurchaseController::class, 'confirm']);
        Route::delete('purchases/{purchase}', [PurchaseController::class, 'destroy']);

        // Milestone 2 — Inventory
        Route::get('inventory/stock', [InventoryController::class, 'stock']);
        Route::get('inventory/alerts', [InventoryController::class, 'alerts']);
        Route::get('inventory/ledger', [InventoryController::class, 'ledger']);
        Route::get('inventory/valuation', [InventoryController::class, 'valuation']);
        Route::get('inventory/movement', [InventoryController::class, 'movement']);

        // Milestone 2 — Purchase returns (debit note + stock reversal)
        Route::get('purchase-returns/source', [PurchaseReturnController::class, 'source']);
        Route::get('purchase-returns', [PurchaseReturnController::class, 'index']);
        Route::post('purchase-returns', [PurchaseReturnController::class, 'store']);
        Route::get('purchase-returns/{purchaseReturn}', [PurchaseReturnController::class, 'show']);
        Route::post('purchase-returns/{purchaseReturn}/confirm', [PurchaseReturnController::class, 'confirm']);
        Route::delete('purchase-returns/{purchaseReturn}', [PurchaseReturnController::class, 'destroy']);

        // Module 01 — Bulk splitting (cost redistribution + stock conversion)
        Route::get('bulk-splits/form-data', [BulkSplitController::class, 'formData']);
        Route::get('bulk-splits', [BulkSplitController::class, 'index']);
        Route::post('bulk-splits', [BulkSplitController::class, 'store']);
        Route::get('bulk-splits/{bulkSplit}', [BulkSplitController::class, 'show']);
        Route::post('bulk-splits/{bulkSplit}/confirm', [BulkSplitController::class, 'confirm']);
        Route::delete('bulk-splits/{bulkSplit}', [BulkSplitController::class, 'destroy']);

        // Milestone 2 — Physical stock verification (HO approval workflow)
        Route::get('stock-verifications/form-data', [StockVerificationController::class, 'formData']);
        Route::get('stock-verifications', [StockVerificationController::class, 'index']);
        Route::post('stock-verifications', [StockVerificationController::class, 'store']);
        Route::get('stock-verifications/{stockVerification}', [StockVerificationController::class, 'show']);
        Route::post('stock-verifications/{stockVerification}/submit', [StockVerificationController::class, 'submit']);
        Route::post('stock-verifications/{stockVerification}/approve', [StockVerificationController::class, 'approve']);
        Route::post('stock-verifications/{stockVerification}/reject', [StockVerificationController::class, 'reject']);

        // Module 14 — Access control: users & roles (company-scoped)
        Route::get('users/form-data', [UserController::class, 'formData']);
        Route::get('users', [UserController::class, 'index']);
        Route::post('users', [UserController::class, 'store']);
        Route::put('users/{user}', [UserController::class, 'update']);
        Route::delete('users/{user}', [UserController::class, 'destroy']);

        Route::get('roles/form-data', [RoleController::class, 'formData']);
        Route::get('roles', [RoleController::class, 'index']);
        Route::post('roles', [RoleController::class, 'store']);
        Route::get('roles/{role}', [RoleController::class, 'show']);
        Route::put('roles/{role}', [RoleController::class, 'update']);
        Route::delete('roles/{role}', [RoleController::class, 'destroy']);
    });
});
