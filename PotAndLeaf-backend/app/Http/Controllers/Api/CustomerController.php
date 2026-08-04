<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\StoreCustomerRequest;
use App\Http\Requests\Customer\UpdateCustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Services\CustomerService;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly CustomerService $customers) {}

    public function index(Request $request): JsonResponse
    {
        $company = $this->company($request);
        $this->allow($request, 'customers.view');

        return $this->ok(CustomerResource::collection(
            $this->customers->list($company->id, $request->only(['search', 'status', 'type', 'per_page']))
        ));
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $company = $this->company($request);
        $customer = $this->customers->create($company->id, $request->validated());

        return $this->created(new CustomerResource($customer), 'Customer created.');
    }

    public function show(Request $request, Customer $customer): JsonResponse
    {
        $this->allow($request, 'customers.view');
        $this->sameCompany($request, $customer);

        return $this->ok(new CustomerResource($customer));
    }

    public function update(UpdateCustomerRequest $request, Customer $customer): JsonResponse
    {
        $this->sameCompany($request, $customer);

        return $this->ok(new CustomerResource($this->customers->update($customer, $request->validated())), 'Customer updated.');
    }

    public function destroy(Request $request, Customer $customer): JsonResponse
    {
        $this->allow($request, 'customers.delete');
        $this->sameCompany($request, $customer);
        $this->customers->delete($customer);

        return $this->message('Customer deleted.');
    }

    private function company(Request $request)
    {
        return $request->attributes->get('company');
    }

    private function allow(Request $request, string $permission): void
    {
        abort_unless($request->user()->hasPermission($permission, $this->company($request)->id), 403);
    }

    private function sameCompany(Request $request, Customer $customer): void
    {
        abort_unless((string) $customer->company_id === (string) $this->company($request)->id, 404);
    }

    public function toggleStatus(Request $request, Customer $customer): JsonResponse
    {
        $company = $this->company($request);
        abort_unless($request->user()->hasPermission('customers.update', $company->id), 403);
        abort_unless((string) $customer->company_id === (string) $company->id, 404);
        $data = $request->validate(['status' => ['required', 'in:active,inactive']]);
        $customer->update(['status' => $data['status']]);

        return $this->ok(['id' => $customer->id, 'status' => $customer->status], 'Status updated.');
    }
}
