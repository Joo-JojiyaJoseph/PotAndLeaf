<?php

namespace App\Http\Requests\Production;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertBomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('production.manage_bom', $this->route('current_company')->id);
    }

    public function rules(): array
    {
        $companyId = $this->route('current_company')->id;
        $prod = fn () => Rule::exists('products', 'id')->where('company_id', $companyId);

        return [
            'product_id' => ['required', 'uuid', $prod()],
            'name'       => ['required', 'string', 'max:150'],
            'output_qty' => ['required', 'numeric', 'gt:0'],
            'is_active'  => ['boolean'],
            'notes'      => ['nullable', 'string', 'max:1000'],
            'items'                        => ['required', 'array', 'min:1'],
            'items.*.component_product_id' => ['required', 'uuid', $prod()],
            'items.*.qty'                  => ['required', 'numeric', 'gt:0'],
        ];
    }
}
