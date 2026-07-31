<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Transfer\ReceiveTransferRequest;
use App\Http\Requests\Transfer\StoreTransferRequest;
use App\Http\Resources\StockTransferResource;
use App\Models\Location;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Services\TransferService;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransferController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly TransferService $transfers) {}

    public function index(Request $request): JsonResponse
    {
        $company = $this->company($request);
        $this->allow($request, 'transfers.view');

        return $this->ok(StockTransferResource::collection($this->transfers->list($company->id, $request->only(['search', 'status', 'per_page']))));
    }

    public function formData(Request $request): JsonResponse
    {
        $company = $this->company($request);
        $this->allow($request, 'transfers.create');

        $locations = Location::forCompany($company->id)->where('is_active', true)->orderByDesc('is_default')->orderBy('name')
            ->get(['id', 'name', 'type', 'is_default'])
            ->map(fn ($l) => ['id' => $l->id, 'name' => $l->name, 'type' => $l->type, 'is_default' => (bool) $l->is_default]);

        $products = Product::forCompany($company->id)->orderBy('name')->get(['id', 'sku', 'name'])
            ->map(fn ($p) => ['id' => $p->id, 'sku' => $p->sku, 'name' => $p->name]);

        return $this->ok(['locations' => $locations, 'products' => $products]);
    }

    public function store(StoreTransferRequest $request): JsonResponse
    {
        $company = $this->company($request);
        $transfer = $this->transfers->create($company->id, $request->validated(), $request->user()->id);

        return $this->created(new StockTransferResource($transfer), 'Transfer saved as draft.');
    }

    public function show(Request $request, StockTransfer $stockTransfer): JsonResponse
    {
        $this->allow($request, 'transfers.view');
        $this->sameCompany($request, $stockTransfer);

        return $this->ok(new StockTransferResource($stockTransfer->load(['items', 'fromLocation:id,name', 'toLocation:id,name'])));
    }

    public function dispatchTransfer(Request $request, StockTransfer $stockTransfer): JsonResponse
    {
        $this->allow($request, 'transfers.dispatch');
        $this->sameCompany($request, $stockTransfer);

        return $this->ok(new StockTransferResource($this->transfers->dispatch($stockTransfer, $request->user()->id)), 'Transfer dispatched — stock in transit.');
    }

    public function receive(ReceiveTransferRequest $request, StockTransfer $stockTransfer): JsonResponse
    {
        $this->sameCompany($request, $stockTransfer);

        $receipts = collect($request->validated()['receipts'] ?? [])->mapWithKeys(fn ($r) => [$r['id'] => $r['received_qty']])->all();

        return $this->ok(new StockTransferResource($this->transfers->receive($stockTransfer, $receipts, $request->user()->id)), 'Transfer received.');
    }

    public function destroy(Request $request, StockTransfer $stockTransfer): JsonResponse
    {
        $this->allow($request, 'transfers.delete');
        $this->sameCompany($request, $stockTransfer);
        $this->transfers->cancel($stockTransfer, $request->user()->id);

        return $this->message('Transfer cancelled.');
    }

    private function company(Request $request)
    {
        return $request->attributes->get('company');
    }

    private function allow(Request $request, string $permission): void
    {
        abort_unless($request->user()->hasPermission($permission, $this->company($request)->id), 403);
    }

    private function sameCompany(Request $request, StockTransfer $transfer): void
    {
        abort_unless((string) $transfer->company_id === (string) $this->company($request)->id, 404);
    }
}
