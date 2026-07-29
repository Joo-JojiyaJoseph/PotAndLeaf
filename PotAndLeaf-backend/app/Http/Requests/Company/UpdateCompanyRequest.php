<?php

namespace App\Http\Requests\Company;

use Illuminate\Validation\Rule;

class UpdateCompanyRequest extends StoreCompanyRequest
{
    public function rules(): array
    {
        $rules = parent::rules();
        $rules['code'] = ['required', 'string', 'max:30',
            Rule::unique('companies', 'code')->whereNull('deleted_at')->ignore($this->route('company')->id)];

        return $rules;
    }
}
