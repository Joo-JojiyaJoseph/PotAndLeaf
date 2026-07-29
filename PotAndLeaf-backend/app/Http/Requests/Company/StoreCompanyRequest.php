<?php

namespace App\Http\Requests\Company;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->is_super_admin;
    }

    public function rules(): array
    {
        return [
            'name'       => ['required', 'string', 'max:150'],
            'code'       => ['required', 'string', 'max:30', Rule::unique('companies', 'code')->whereNull('deleted_at')],
            'legal_name' => ['nullable', 'string', 'max:200'],
            'gst_number' => ['nullable', 'string', 'max:20'],
            'state'      => ['nullable', 'string', 'max:60'],
            'state_code' => ['nullable', 'string', 'max:2'],
            'address'    => ['nullable', 'string', 'max:500'],
            'phone'      => ['nullable', 'string', 'max:20'],
            'email'      => ['nullable', 'email', 'max:150'],
            'is_active'  => ['boolean'],
        ];
    }
}
