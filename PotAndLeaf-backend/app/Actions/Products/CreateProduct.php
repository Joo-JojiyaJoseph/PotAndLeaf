<?php

namespace App\Actions\Products;

use App\Models\Product;
use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Support\Barcode\BarcodeGenerator;
use Illuminate\Support\Facades\DB;

class CreateProduct
{
    public function __construct(
        private readonly ProductRepositoryInterface $products,
        private readonly BarcodeGenerator $barcodes,
    ) {}

    /** @param array<string,mixed> $data */
    public function handle(int|string $companyId, array $data): Product
    {
        return DB::transaction(function () use ($companyId, $data) {
            $suppliers = $this->pullSuppliers($data);

            if (empty($data['barcode'])) {
                $data['barcode'] = $this->barcodes->forProduct($companyId);
            }

            $product = $this->products->create([
                ...$data,
                'company_id'       => $companyId,
                'current_stock' => $data['opening_stock'] ?? 0,
            ]);

            $product->suppliers()->sync($suppliers);

            // Side effects: opening-stock ledger entry, barcode generation,
            // low-stock check, activity log — hook them in here later.

            return $product->load('suppliers');
        });
    }

    /**
     * Convert the form's supplier rows into a sync payload:
     * [supplier_id => ['supplier_price' => x, 'is_primary' => bool]]
     */
    private function pullSuppliers(array &$data): array
    {
        $rows = $data['suppliers'] ?? [];
        unset($data['suppliers']);

        return collect($rows)
            ->filter(fn ($r) => filled($r['supplier_id'] ?? null))
            ->mapWithKeys(fn ($r) => [
                $r['supplier_id'] => [
                    'supplier_price' => $r['supplier_price'] ?? 0,
                    'is_primary'     => (bool) ($r['is_primary'] ?? false),
                ],
            ])->all();
    }
}
