<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $company = $request->attributes->get('company');
        abort_unless($request->user()->hasPermission('products.view', $company->id), 403);

        $products = Product::query()
            ->forCompany($company->id)
            ->with('unit:id,short_name,name')
            ->when(filled($request->query('search')), fn ($q) => $q->search($request->query('search')))
            ->orderBy('name')
            ->paginate(min((int) $request->query('per_page', 20), 100))
            ->withQueryString();

        return $this->ok(ProductResource::collection($products));
    }
}
