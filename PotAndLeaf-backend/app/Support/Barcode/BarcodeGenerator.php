<?php

namespace App\Support\Barcode;

use App\Models\Product;

/**
 * Generates a stable, company-scoped barcode value for products. The value is
 * Code128-friendly (alphanumeric) and unique per company via a running count,
 * e.g. "PL1-000042". The visual Code128 is rendered client-side for labels.
 */
class BarcodeGenerator
{
    public function forProduct(int|string $companyId): string
    {
        $seq = Product::withTrashed()->where('company_id', $companyId)->count() + 1;

        return sprintf('PL%s-%06d', $companyId, $seq);
    }
}
