<?php

use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Entité 12 : tenders
        Schema::create('tenders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('buyer_id')->constrained('buyer_profiles')->cascadeOnDelete();
            $table->string('title');
            $table->text('description');
            $table->foreignId('category_id')->constrained('categories')->restrictOnDelete();
            $table->foreignId('region_id')->nullable()->constrained('regions')->nullOnDelete();
            $table->decimal('budget', 12, 2)->nullable();
            $table->date('desired_deadline')->nullable();
            $table->enum('status', TenderStatus::values())->default(TenderStatus::OPEN->value)->index();
            $table->foreignId('ai_category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->json('ai_keywords')->nullable();
            $table->timestamps();
        });

        // Entité 13 : tender_attachments
        Schema::create('tender_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tender_id')->constrained('tenders')->cascadeOnDelete();
            $table->string('file_path');
            $table->timestamps();
        });

        // Entité 14 : tender_recipients
        Schema::create('tender_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tender_id')->constrained('tenders')->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained('supplier_profiles')->cascadeOnDelete();
            $table->decimal('score', 5, 2)->nullable();
            $table->enum('source', ['automatique', 'suggéré IA', 'invité'])->default('automatique');
            $table->timestamp('notified_at')->nullable();
            $table->timestamp('seen_at')->nullable();
            $table->timestamps();
            $table->unique(['tender_id', 'supplier_id']);
        });

        // Entité 15 : quotes (Règle #1 : unique (tender_id, supplier_id))
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tender_id')->constrained('tenders')->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained('supplier_profiles')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->unsignedInteger('delivery_days');
            $table->text('conditions')->nullable();
            $table->text('comment')->nullable();
            $table->enum('status', QuoteStatus::values())->default(QuoteStatus::SENT->value)->index();
            $table->timestamps();
            $table->unique(['tender_id', 'supplier_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotes');
        Schema::dropIfExists('tender_recipients');
        Schema::dropIfExists('tender_attachments');
        Schema::dropIfExists('tenders');
    }
};
