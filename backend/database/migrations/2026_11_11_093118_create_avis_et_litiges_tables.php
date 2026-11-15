<?php

use App\Enums\DisputeStatus;
use App\Enums\ReviewStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Entité 25 : reviews (Règle #2 : order_id unique)
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained('orders')->restrictOnDelete();
            $table->foreignId('buyer_id')->constrained('buyer_profiles')->restrictOnDelete();
            $table->foreignId('supplier_id')->constrained('supplier_profiles')->restrictOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->text('supplier_reply')->nullable();
            $table->enum('status', ReviewStatus::values())->default(ReviewStatus::PUBLISHED->value)->index();
            $table->decimal('ai_suspicion_score', 5, 2)->nullable();
            $table->string('ai_sentiment')->nullable();
            $table->timestamps();
        });

        // Entité 26 : review_reports
        Schema::create('review_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_id')->constrained('reviews')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->string('reason');
            $table->string('status')->default('en attente')->index();
            $table->text('admin_decision')->nullable();
            $table->timestamps();
            $table->unique(['review_id', 'author_id']);
        });

        // Entité 27 : disputes
        Schema::create('disputes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->restrictOnDelete();
            $table->foreignId('opened_by')->constrained('users')->restrictOnDelete();
            $table->string('reason');
            $table->text('description');
            $table->enum('status', DisputeStatus::values())->default(DisputeStatus::OPEN->value)->index();
            $table->foreignId('assigned_admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('decision')->nullable();
            $table->text('decision_note')->nullable();
            $table->timestamps();
        });

        // Entité 28 : dispute_attachments
        Schema::create('dispute_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dispute_id')->constrained('disputes')->cascadeOnDelete();
            $table->string('file_path');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispute_attachments');
        Schema::dropIfExists('disputes');
        Schema::dropIfExists('review_reports');
        Schema::dropIfExists('reviews');
    }
};
