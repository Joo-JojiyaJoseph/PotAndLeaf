<?php

namespace App\Actions\Customers;

use App\Models\Customer;
use App\Repositories\Contracts\CustomerRepositoryInterface;

class UpdateCustomer
{
    public function __construct(private readonly CustomerRepositoryInterface $customers) {}

    /** @param array<string,mixed> $data */
    public function handle(Customer $customer, array $data): Customer
    {
        return $this->customers->update($customer, $data);
    }
}
