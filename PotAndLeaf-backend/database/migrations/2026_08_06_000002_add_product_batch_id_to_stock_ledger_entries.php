<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Let a stock movement reference the batch it belongs to. An inbound (purchase)
 * movement is always exactly one batch, so this is populated at purchase
 * confirmation. Outbound movements stay null in Phase 1 (aggregate costing);
 * they get their batch when FIFO/FEFO consumption is enabled in Phase 2.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_ledger_entries', function (Blueprint $table) {
            $table->foreignUuid('product_batch_id')->nullable()->after('product_id')
                ->constrained('product_batches')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('stock_ledger_entries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_batch_id');
        });
    }
};
