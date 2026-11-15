<?php

use App\Enums\ProductStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Entité 8 : products
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_id')->constrained('supplier_profiles')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('categories')->restrictOnDelete();
            $table->enum('type', ['produit', 'service'])->default('produit');
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('price', 12, 2);
            $table->string('unit')->nullable();
            $table->integer('stock')->nullable();
            $table->unsignedInteger('availability_days')->nullable();
            $table->enum('status', ProductStatus::values())->default(ProductStatus::DRAFT->value);
            $table->timestamp('featured_until')->nullable();
            $table->text('ai_flag_reason')->nullable();
            $table->text('withdrawal_reason')->nullable();
            $table->timestamps();
            $table->index(['status', 'category_id']);
        });

        // Entité 9 : product_images
        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('path');
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        // Entité 10 : product_views
        Schema::create('product_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('viewed_at')->useCurrent();
            $table->index(['product_id', 'viewed_at']);
        });

        // Entité 11 : favorites
        Schema::create('favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('buyer_id')->constrained('buyer_profiles')->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained('supplier_profiles')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['buyer_id', 'supplier_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('favorites');
        Schema::dropIfExists('product_views');
        Schema::dropIfExists('product_images');
        Schema::dropIfExists('products');
    }
};
