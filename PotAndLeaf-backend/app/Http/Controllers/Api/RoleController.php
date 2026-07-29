<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Role\StoreRoleRequest;
use App\Http\Requests\Role\UpdateRoleRequest;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use App\Services\RoleService;
use App\Support\Api\ApiResponse;
use App\Support\Rbac\PermissionRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly RoleService $roles) {}

    public function index(Request $request): JsonResponse
    {
        $company = $this->company($request);
        $this->allow($request, 'roles.view');

        return $this->ok(RoleResource::collection($this->roles->list($company->id, $request->only(['search', 'per_page']))));
    }

    /** The permission matrix (module → permission → label) for building role forms. */
    public function formData(Request $request): JsonResponse
    {
        $this->allow($request, 'roles.view');

        return $this->ok(['permission_groups' => PermissionRegistry::groups()]);
    }

    public function store(StoreRoleRequest $request): JsonResponse
    {
        $company = $this->company($request);
        $role = $this->roles->create($company->id, $request->validated());

        return $this->created(new RoleResource($role->load('permissions')), 'Role created.');
    }

    public function show(Request $request, Role $role): JsonResponse
    {
        $this->allow($request, 'roles.view');
        $this->sameCompany($request, $role);

        return $this->ok(new RoleResource($role->load('permissions')));
    }

    public function update(UpdateRoleRequest $request, Role $role): JsonResponse
    {
        $this->sameCompany($request, $role);
        $updated = $this->roles->update($role, $request->validated());

        return $this->ok(new RoleResource($updated->load('permissions')), 'Role updated.');
    }

    public function destroy(Request $request, Role $role): JsonResponse
    {
        $this->allow($request, 'roles.delete');
        $this->sameCompany($request, $role);
        $this->roles->delete($role);

        return $this->message('Role deleted.');
    }

    private function company(Request $request)
    {
        return $request->attributes->get('company');
    }

    private function allow(Request $request, string $permission): void
    {
        abort_unless($request->user()->hasPermission($permission, $this->company($request)->id), 403);
    }

    private function sameCompany(Request $request, Role $role): void
    {
        abort_unless((string) $role->company_id === (string) $this->company($request)->id, 404);
    }
}
