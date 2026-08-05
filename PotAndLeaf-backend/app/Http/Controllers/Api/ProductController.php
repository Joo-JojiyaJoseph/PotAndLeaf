<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Product\StoreProductRequest;
use App\Http\Requests\Product\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\ProductBrand;
use App\Models\ProductCategory;
use App\Models\ProductUnit;
use App\Models\Supplier;
use App\Services\ProductService;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly ProductService $products) {}

    public function index(Request $request): JsonResponse
    {
        $company = $this->company($request);
        $this->allow($request, 'products.view');

        $products = Product::query()
            ->forCompany($company->id)
            ->with(['unit:id,short_name,name', 'category:id,name'])
            ->when(filled($request->query('search')), fn ($q) => $q->search($request->query('search')))
            ->when(filled($request->query('category_id')), fn ($q) => $q->where('category_id', $request->query('category_id')))
            ->when(filled($request->query('status')), fn ($q) => $q->where('status', $request->query('status')))
            ->when($request->boolean('low_only'), fn ($q) => $q->whereColumn('current_stock', '<=', 'reorder_level'))
            ->orderBy('name')
            ->paginate(min((int) $request->query('per_page', 20), 100))
            ->withQueryString();

        return $this->ok(ProductResource::collection($products));
    }

    /** Lookups the product form needs: categories, brands, units, tax rates. */
    public function formData(Request $request): JsonResponse
    {
        $company = $this->company($request);
        $this->allow($request, 'products.view');

        $map = fn ($rows) => $rows->map(fn ($r) => ['id' => $r->id, 'name' => $r->name] + (isset($r->short_name) ? ['short_name' => $r->short_name] : []));

        return $this->ok([
            'categories' => $map(ProductCategory::where('company_id', $company->id)->orderBy('name')->get(['id', 'name'])),
            'brands'     => $map(ProductBrand::where('company_id', $company->id)->orderBy('name')->get(['id', 'name'])),
            'units'      => ProductUnit::where('company_id', $company->id)->orderBy('name')->get(['id', 'name', 'short_name'])
                ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'short_name' => $u->short_name]),
            'suppliers'  => Supplier::forCompany($company->id)->orderBy('name')->get(['id', 'name'])
                ->map(fn ($s) => ['id' => $s->id, 'name' => $s->name]),
            'tax_rates'  => [0, 5, 12, 18, 28],
        ]);
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $company = $this->company($request);
        $product = $this->products->create($company->id, $request->validated());

        return $this->created(new ProductResource($product->load(['category', 'brand', 'unit'])), 'Product created.');
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        $this->allow($request, 'products.view');
        $this->sameCompany($request, $product);

        return $this->ok(new ProductResource($product->load(['category', 'brand', 'unit', 'suppliers'])));
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $this->sameCompany($request, $product);
        $updated = $this->products->update($product, $request->validated());

        return $this->ok(new ProductResource($updated->load(['category', 'brand', 'unit'])), 'Product updated.');
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        $this->allow($request, 'products.delete');
        $this->sameCompany($request, $product);
        $this->products->delete($product);

        return $this->message('Product deleted.');
    }

    /** Batches (received lots + their barcodes) for this product. */
    public function batches(Request $request, Product $product): JsonResponse
    {
        $this->allow($request, 'products.view');
        $this->sameCompany($request, $product);

        $batches = \App\Models\ProductBatch::forCompany($product->company_id)
            ->where('product_id', $product->id)
            ->with(['supplier:id,name', 'purchase:id,purchase_no'])
            ->orderByDesc('received_at')
            ->get()
            ->each(fn ($b) => $b->setRelation('product', $product));

        return $this->ok(\App\Http\Resources\ProductBatchResource::collection($batches));
    }

    private function company(Request $request)
    {
        return $request->attributes->get('company');
    }

    private function allow(Request $request, string $permission): void
    {
        abort_unless($request->user()->hasPermission($permission, $this->company($request)->id), 403);
    }

    private function sameCompany(Request $request, Product $product): void
    {
        abort_unless((string) $product->company_id === (string) $this->company($request)->id, 404);
    }

    public function toggleStatus(Request $request, Product $product): JsonResponse
    {
        $company = $request->attributes->get('company');
        abort_unless($request->user()->hasPermission('products.update', $company->id), 403);
        abort_unless((string) $product->company_id === (string) $company->id, 404);

        $data = $request->validate(['status' => ['required', 'in:active,inactive']]);
        $product->update(['status' => $data['status']]);

        return $this->ok(['id' => $product->id, 'status' => $product->status], 'Status updated.');
    }
}
