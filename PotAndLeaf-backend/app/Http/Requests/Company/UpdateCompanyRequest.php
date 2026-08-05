<?php

namespace App\Http\Requests\Company;

use Illuminate\Validation\Rule;

class UpdateCompanyRequest extends StoreCompanyRequest
{
    public function rules(): array
    {
        $id = $this->route('company')->id;

        return [
            'name'        => ['required', 'string', 'max:150'],
            'code'        => ['required', 'string', 'max:30', Rule::unique('companies', 'code')->whereNull('deleted_at')->ignore($id)],
            'legal_name'  => ['nullable', 'string', 'max:200'],
            'gst_number'  => ['nullable', 'string', 'max:20'],
            'state'       => ['nullable', 'string', 'max:60'],
            'state_code'  => ['nullable', 'string', 'max:2'],
            'address'     => ['nullable', 'string', 'max:500'],
            'phone'       => ['nullable', 'string', 'max:20'],
            'email'       => ['nullable', 'email', 'max:150'],
            'logo'        => ['nullable', 'string', 'max:500'],
            'photo'       => ['nullable', 'string', 'max:500'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active'   => ['boolean'],
        ];
    }
}
