<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\PurchaseReturnController;
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

    // Company-scoped
    Route::middleware(ResolveApiCompany::class)->group(function () {
        Route::get('permissions', [AuthController::class, 'permissions']);
        Route::get('dashboard', [DashboardController::class, 'index']);

        Route::get('suppliers', [SupplierController::class, 'index']);
        Route::post('suppliers', [SupplierController::class, 'store']);
        Route::get('suppliers/{supplier}', [SupplierController::class, 'show']);
        Route::put('suppliers/{supplier}', [SupplierController::class, 'update']);
        Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy']);

        // Products (read for now; master CRUD screen is Milestone 1 follow-up)
        Route::get('products', [ProductController::class, 'index']);

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

        // Milestone 2 — Purchase returns (debit note + stock reversal)
        Route::get('purchase-returns/source', [PurchaseReturnController::class, 'source']);
        Route::get('purchase-returns', [PurchaseReturnController::class, 'index']);
        Route::post('purchase-returns', [PurchaseReturnController::class, 'store']);
        Route::get('purchase-returns/{purchaseReturn}', [PurchaseReturnController::class, 'show']);
        Route::post('purchase-returns/{purchaseReturn}/confirm', [PurchaseReturnController::class, 'confirm']);
        Route::delete('purchase-returns/{purchaseReturn}', [PurchaseReturnController::class, 'destroy']);

        // Milestone 2 — Physical stock verification (HO approval workflow)
        Route::get('stock-verifications/form-data', [StockVerificationController::class, 'formData']);
        Route::get('stock-verifications', [StockVerificationController::class, 'index']);
        Route::post('stock-verifications', [StockVerificationController::class, 'store']);
        Route::get('stock-verifications/{stockVerification}', [StockVerificationController::class, 'show']);
        Route::post('stock-verifications/{stockVerification}/submit', [StockVerificationController::class, 'submit']);
        Route::post('stock-verifications/{stockVerification}/approve', [StockVerificationController::class, 'approve']);
        Route::post('stock-verifications/{stockVerification}/reject', [StockVerificationController::class, 'reject']);
    });
});
