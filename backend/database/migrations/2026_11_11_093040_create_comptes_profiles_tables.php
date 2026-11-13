<?php

use App\Enums\ValidationStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Entité 4 : supplier_profiles
        Schema::create('supplier_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('company_name');
            $table->string('logo')->nullable();
            $table->text('description')->nullable();
            $table->string('sector')->nullable();
            $table->foreignId('region_id')->nullable()->constrained('regions')->nullOnDelete();
            $table->string('contact')->nullable();
            $table->boolean('is_published')->default(false)->index();
            $table->enum('validation_status', ValidationStatus::values())->default(ValidationStatus::PENDING->value)->index();
            $table->text('rejection_reason')->nullable();
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('validated_at')->nullable();
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->unsignedInteger('reviews_count')->default(0);
            $table->timestamps();
        });

        // Entité 5 : buyer_profiles
        Schema::create('buyer_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('organization');
            $table->string('sector')->nullable();
            $table->timestamps();
        });

        // Entité 6 : supplier_documents
        Schema::create('supplier_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_id')->constrained('supplier_profiles')->cascadeOnDelete();
            $table->enum('type', ['registre de commerce', 'certification']);
            $table->string('file_path');
            $table->enum('status', ValidationStatus::values())->default(ValidationStatus::PENDING->value)->index();
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamps();
        });

        // Entité 7 : notification_preferences
        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('event_type');
            $table->enum('channel', ['email', 'site']);
            $table->boolean('enabled')->default(true);
            $table->timestamps();
            $table->unique(['user_id', 'event_type', 'channel'], 'notif_pref_user_event_channel_unique');
        });

        // Pivot 1 : supplier_category
        Schema::create('supplier_category', function (Blueprint $table) {
            $table->foreignId('supplier_id')->constrained('supplier_profiles')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('categories')->cascadeOnDelete();
            $table->primary(['supplier_id', 'category_id']);
        });

        // Pivot 2 : supplier_coverage_region
        Schema::create('supplier_coverage_region', function (Blueprint $table) {
            $table->foreignId('supplier_id')->constrained('supplier_profiles')->cascadeOnDelete();
            $table->foreignId('region_id')->constrained('regions')->cascadeOnDelete();
            $table->primary(['supplier_id', 'region_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_coverage_region');
        Schema::dropIfExists('supplier_category');
        Schema::dropIfExists('notification_preferences');
        Schema::dropIfExists('supplier_documents');
        Schema::dropIfExists('buyer_profiles');
        Schema::dropIfExists('supplier_profiles');
    }
};
