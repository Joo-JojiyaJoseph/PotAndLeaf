<?php

namespace App\Actions\Sales;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Repositories\Contracts\SaleRepositoryInterface;
use App\Support\Sales\SaleCalculator;
use Illuminate\Support\Facades\DB;

class CreateSale
{
    public function __construct(
        private readonly SaleRepositoryInterface $sales,
        private readonly SaleCalculator $calculator,
    ) {}

    /** @param array<string,mixed> $data */
    public function handle(int|string $companyId, array $data, ?int $userId = null): Sale
    {
        $computed = $this->calculator->compute($data['items'], (bool) ($data['is_interstate'] ?? false));

        $customerName = $data['customer_name'] ?? null;
        if (! empty($data['customer_id'])) {
            $customerName = Customer::forCompany($companyId)->find($data['customer_id'])?->name ?? $customerName;
        }
        $customerName ??= 'Walk-in';

        $productMeta = Product::forCompany($companyId)
            ->whereIn('id', collect($data['items'])->pluck('product_id')->filter())
            ->get(['id', 'name', 'hsn_code'])
            ->keyBy('id');

        return DB::transaction(function () use ($companyId, $data, $computed, $customerName, $productMeta) {
            $t = $computed['totals'];
            $sale = $this->sales->create([
                'company_id'    => $companyId,
                'customer_id'   => $data['customer_id'] ?? null,
                'location_id'   => $data['location_id'] ?? null,
                'customer_name' => $customerName,
                'sale_no'       => $this->sales->nextSaleNo($companyId),
                'sale_date'     => $data['sale_date'],
                'is_interstate' => (bool) ($data['is_interstate'] ?? false),
                'payment_mode'  => $data['payment_mode'] ?? 'cash',
                'subtotal'      => $t['subtotal'],
                'tax_total'     => $t['tax_total'],
                'round_off'     => $t['round_off'],
                'grand_total'   => $t['grand_total'],
                'amount_paid'   => $data['amount_paid'] ?? $t['grand_total'],
                'status'        => 'draft',
                'notes'         => $data['notes'] ?? null,
            ]);

            $rows = [];
            foreach ($data['items'] as $i => $item) {
                $calc = $computed['lines'][$i];
                $meta = $productMeta[$item['product_id']] ?? null;
                $rows[] = [
                    'product_id'    => $item['product_id'],
                    'product_name'  => $meta->name ?? 'Item',
                    'hsn_code'      => $meta->hsn_code ?? null,
                    'qty'           => $item['qty'],
                    'rate'          => $item['rate'],
                    'discount'      => $item['discount'] ?? 0,
                    'gst_rate'      => $item['gst_rate'] ?? 0,
                    'taxable_value' => $calc['taxable_value'],
                    'cgst_amount'   => $calc['cgst_amount'],
                    'sgst_amount'   => $calc['sgst_amount'],
                    'igst_amount'   => $calc['igst_amount'],
                    'line_total'    => $calc['line_total'],
                ];
            }
            $sale->items()->createMany($rows);

            return $sale->load(['items', 'customer:id,name,type']);
        });
    }
}
