<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductBrand;
use App\Models\ProductCategory;
use App\Models\ProductUnit;
use App\Support\Api\ApiResponse;
use App\Support\Api\ResolvesFilterCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * One controller for the three product master lists (categories, brands, units).
 * Each is a simple company-scoped lookup; the {type} segment selects which.
 */
class MasterDataController extends Controller
{
    use ApiResponse, ResolvesFilterCompany;

    private const TYPES = [
        'categories' => [ProductCategory::class, 'categories', ['name', 'code', 'description', 'parent_id', 'status'], true],
        'brands'     => [ProductBrand::class, 'brands', ['name', 'code', 'description', 'status'], false],
        'units'      => [ProductUnit::class, 'units', ['name', 'code', 'short_name', 'description', 'status'], false],
    ];

    public function index(Request $request, string $type): JsonResponse
    {
        [$model, $perm, , $hasParent] = $this->resolve($type);
        $companyId = $this->listCompany($request)->id;
        $this->allow($request, "{$perm}.view", $companyId);

        $rows = $model::where('company_id', $companyId)->orderBy('name')->get();
        $parents = $hasParent ? $rows->pluck('name', 'id') : collect();

        return $this->ok($rows->map(fn ($r) => $this->present($r, $type, $parents))->values());
    }

    public function store(Request $request, string $type): JsonResponse
    {
        [$model, $perm, $fields, $hasParent] = $this->resolve($type);
        $companyId = $this->companyId($request);
        $this->allow($request, "{$perm}.create", $companyId);

        $data = $this->validated($request, $type, $companyId, $hasParent, null);
        $row = $model::create($data + ['company_id' => $companyId]);

        return $this->created($this->present($row, $type, collect()), ucfirst(rtrim($type, 's')).' created.');
    }

    public function update(Request $request, string $type, string $id): JsonResponse
    {
        [$model, $perm, $fields, $hasParent] = $this->resolve($type);
        $companyId = $this->companyId($request);
        $this->allow($request, "{$perm}.update", $companyId);

        $row = $model::where('company_id', $companyId)->findOrFail($id);
        $row->update($this->validated($request, $type, $companyId, $hasParent, $id));

        return $this->ok($this->present($row->refresh(), $type, collect()), 'Updated.');
    }

    public function destroy(Request $request, string $type, string $id): JsonResponse
    {
        [$model, $perm] = $this->resolve($type);
        $companyId = $this->companyId($request);
        $this->allow($request, "{$perm}.delete", $companyId);

        $model::where('company_id', $companyId)->findOrFail($id)->delete();

        return $this->message('Deleted.');
    }

    private function validated(Request $request, string $type, int|string $companyId, bool $hasParent, ?string $id): array
    {
        $rules = [
            'name'        => ['required', 'string', 'max:150'],
            'code'        => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status'      => ['nullable', 'in:active,inactive'],
        ];
        if ($type === 'units') {
            $rules['short_name'] = ['nullable', 'string', 'max:20'];
        }
        if ($hasParent) {
            $exists = Rule::exists('product_categories', 'id')->where('company_id', $companyId);
            $rules['parent_id'] = ['nullable', 'uuid', $exists];
        }
        $data = $request->validate($rules);
        $data['status'] ??= 'active';
        if ($hasParent && ($data['parent_id'] ?? null) === $id) {
            $data['parent_id'] = null; // a category cannot be its own parent
        }

        return $data;
    }

    private function present($r, string $type, $parents): array
    {
        $out = [
            'id'          => $r->id,
            'name'        => $r->name,
            'code'        => $r->code,
            'description' => $r->description,
            'status'      => $r->status,
        ];
        if ($type === 'units') {
            $out['short_name'] = $r->short_name;
        }
        if ($type === 'categories') {
            $out['parent_id'] = $r->parent_id;
            $out['parent_name'] = $r->parent_id ? ($parents[$r->parent_id] ?? null) : null;
        }

        return $out;
    }

    private function resolve(string $type): array
    {
        abort_unless(array_key_exists($type, self::TYPES), 404, 'Unknown master type.');

        return self::TYPES[$type];
    }

    private function companyId(Request $request)
    {
        return $request->attributes->get('company')->id;
    }

    private function allow(Request $request, string $permission, int|string $companyId): void
    {
        abort_unless($request->user()->hasPermission($permission, $companyId), 403);
    }
}
