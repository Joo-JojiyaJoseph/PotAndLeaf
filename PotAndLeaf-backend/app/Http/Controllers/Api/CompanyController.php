<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Company\StoreCompanyRequest;
use App\Http\Requests\Company\UpdateCompanyRequest;
use App\Http\Resources\CompanyResource;
use App\Models\Company;
use App\Support\Api\ApiResponse;
use App\Support\Media\MediaStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

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
        $data = $request->validated();
        unset($data['password_confirmation'], $data['photo']);
        $company = Company::create($data);

        return $this->created(new CompanyResource($company), 'Company created.');
    }

    public function show(Request $request, Company $company): JsonResponse
    {
        $this->ensureSuperAdmin($request);

        return $this->ok(new CompanyResource($company));
    }

    public function update(UpdateCompanyRequest $request, Company $company): JsonResponse
    {
        $data = $request->validated();
        unset($data['password_confirmation'], $data['photo']);

        if (array_key_exists('logo', $data)) {
            $data['logo'] = MediaStorage::replace($company->logo, $data['logo']);
        }

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $company->update($data);

        return $this->ok(new CompanyResource($company->fresh()), 'Company updated.');
    }

    public function destroy(Request $request, Company $company): JsonResponse
    {
        $this->ensureSuperAdmin($request);
        $company->delete();

        return $this->message('Company deleted.');
    }

    public function resetPassword(Request $request, Company $company): JsonResponse
    {
        $this->ensureSuperAdmin($request);

        $data = $request->validate([
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'generate' => ['sometimes', 'boolean'],
        ]);

        $plain = null;
        if (! empty($data['generate'])) {
            $plain = Str::password(12);
            $company->update(['password' => $plain]);
        } else {
            abort_unless(! empty($data['password']), 422, 'Provide a password or set generate=true.');
            $company->update(['password' => $data['password']]);
        }

        return $this->ok([
            'id' => $company->id,
            'temporary_password' => $plain,
        ], $plain ? 'Temporary password generated.' : 'Password updated.');
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
