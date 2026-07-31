<?php

namespace App\Http\Requests\Transfer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTransferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('transfers.create', $this->route('current_company')->id);
    }

    public function rules(): array
    {
        $companyId = $this->route('current_company')->id;
        $loc = fn () => Rule::exists('locations', 'id')->where('company_id', $companyId);

        return [
            'from_location_id' => ['required', 'uuid', $loc()],
            'to_location_id'   => ['required', 'uuid', 'different:from_location_id', $loc()],
            'transfer_date'    => ['required', 'date'],
            'notes'            => ['nullable', 'string', 'max:1000'],
            'items'              => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'uuid', Rule::exists('products', 'id')->where('company_id', $companyId)],
            'items.*.qty'        => ['required', 'numeric', 'gt:0'],
        ];
    }
}
