<?php

namespace App\Actions\Customers;

use App\Models\Customer;
use App\Repositories\Contracts\CustomerRepositoryInterface;

class CreateCustomer
{
    public function __construct(private readonly CustomerRepositoryInterface $customers) {}

    /** @param array<string,mixed> $data */
    public function handle(int|string $companyId, array $data): Customer
    {
        if (empty($data['customer_code'])) {
            $data['customer_code'] = $this->customers->nextCustomerCode($companyId);
        }
        $data['company_id'] = $companyId;

        return $this->customers->create($data);
    }
}
