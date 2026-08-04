<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Company\StoreCompanyRequest;
use App\Http\Requests\Company\UpdateCompanyRequest;
use App\Http\Resources\CompanyResource;
use App\Models\Company;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Company management — the super-admin (HO) surface. Not company-scoped: these
 * routes sit outside ResolveApiCompany and are gated on is_super_admin.
 */
class CompanyController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $this->ensureSuperAdmin($request);

        $companies = Company::query()->withCount('users')->orderBy('name')->get();

        return $this->ok(CompanyResource::collection($companies));
    }

    public function store(StoreCompanyRequest $request): JsonResponse
    {
        $company = Company::create($request->validated());

        return $this->created(new CompanyResource($company), 'Company created.');
    }

    public function show(Request $request, Company $company): JsonResponse
    {
        $this->ensureSuperAdmin($request);

        return $this->ok(new CompanyResource($company));
    }

    public function update(UpdateCompanyRequest $request, Company $company): JsonResponse
    {
        $company->update($request->validated());

        return $this->ok(new CompanyResource($company), 'Company updated.');
    }

    public function destroy(Request $request, Company $company): JsonResponse
    {
        $this->ensureSuperAdmin($request);
        $company->delete();

        return $this->message('Company deleted.');
    }

    private function ensureSuperAdmin(Request $request): void
    {
        abort_unless((bool) $request->user()?->is_super_admin, 403, 'Only HO super admins can manage companies.');
    }

    public function toggleStatus(Request $request, Company $company): JsonResponse
    {
        abort_unless((bool) $request->user()?->is_super_admin, 403, 'Only HO super admins can manage companies.');
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $company->update(['is_active' => $data['is_active']]);

        return $this->ok(['id' => $company->id, 'is_active' => (bool) $company->is_active], 'Status updated.');
    }
}
