<?php

namespace App\Actions\Customers;

use App\Models\Customer;
use App\Repositories\Contracts\CustomerRepositoryInterface;
use App\Support\Media\MediaStorage;

class UpdateCustomer
{
    public function __construct(private readonly CustomerRepositoryInterface $customers) {}

    /** @param array<string,mixed> $data */
    public function handle(Customer $customer, array $data): Customer
    {
        if (array_key_exists('photo', $data)) {
            $data['photo'] = MediaStorage::replace($customer->photo, $data['photo']);
        }

        return $this->customers->update($customer, $data);
    }
}
