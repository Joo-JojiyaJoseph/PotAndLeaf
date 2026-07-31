<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Http\Resources\StockLedgerResource;
use App\Services\InventoryService;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly InventoryService $inventory) {}

    public function stock(Request $request): JsonResponse
    {
        $company = $this->allow($request);

        $filters = [
            'search'   => $request->query('search'),
            'low_only' => $request->boolean('low_only'),
            'per_page' => $request->query('per_page'),
        ];

        $levels = $this->inventory->stockLevels($company->id, $filters);
        $levels->loadMissing('unit:id,short_name,name');

        return $this->ok(ProductResource::collection($levels));
    }

    public function alerts(Request $request): JsonResponse
    {
        $company = $this->allow($request);

        return $this->ok(
            $this->inventory->reorderAlerts($company->id)->map(fn ($p) => [
                'id'            => $p->id,
                'sku'           => $p->sku,
                'name'          => $p->name,
                'current_stock' => (float) $p->current_stock,
                'reorder_level' => (float) $p->reorder_level,
            ])
        );
    }

    public function ledger(Request $request): JsonResponse
    {
        $company = $this->allow($request);
        $request->validate(['product_id' => ['required', 'uuid']]);

        return $this->ok(
            StockLedgerResource::collection(
                $this->inventory->ledgerFor($company->id, $request->query('product_id'))
            )
        );
    }

    public function valuation(Request $request): JsonResponse
    {
        $company = $this->allow($request);

        return $this->ok($this->inventory->valuation($company->id));
    }

    public function movement(Request $request): JsonResponse
    {
        $company = $this->allow($request);
        $days = max(1, min((int) $request->query('days', 30), 365));

        return $this->ok($this->inventory->movement($company->id, $days));
    }

    public function byLocation(Request $request, \App\Services\LocationStockService $locations): JsonResponse
    {
        $company = $this->allow($request);
        $locationId = $request->query('location_id') ?: null;

        return $this->ok(['balances' => $locations->balances($company->id, $locationId)]);
    }

    private function allow(Request $request)
    {
        $company = $request->attributes->get('company');
        abort_unless($request->user()->hasPermission('inventory.view', $company->id), 403);

        return $company;
    }
}
