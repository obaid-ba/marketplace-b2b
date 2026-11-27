<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Repères de déploiement (clé → valeur) : mémorise les opérations à ne faire qu'une fois,
 * comme la réinitialisation des données de démonstration (commande demo:reset).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deployment_markers', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('value');
            $table->timestamp('applied_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deployment_markers');
    }
};
