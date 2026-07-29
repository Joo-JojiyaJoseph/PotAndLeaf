<?php

namespace App\Http\Requests\Product;

use Illuminate\Validation\Rule;

class UpdateProductRequest extends StoreProductRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('product'));
    }

    public function rules(): array
    {
        $companyId = $this->route('current_company')->id;
        $productId = $this->route('product')->id;

        return array_merge($this->baseRules($companyId, $productId), [
            'sku' => [
                'required', 'string', 'max:50',
                Rule::unique('products', 'sku')->where('company_id', $companyId)
                    ->whereNull('deleted_at')->ignore($productId),
            ],
        ]);
    }
}
