<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Index du catalogue public (SCRUM-35) : filtre et tri par prix, tri par nouveauté,
 * images d'un produit dans l'ordre. (status, category_id) et supplier_id existent déjà.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->index(['status', 'price']);
            $table->index(['status', 'created_at']);
        });

        Schema::table('product_images', function (Blueprint $table) {
            $table->index(['product_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::table('product_images', function (Blueprint $table) {
            $table->dropIndex(['product_id', 'position']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['status', 'price']);
            $table->dropIndex(['status', 'created_at']);
        });
    }
};
