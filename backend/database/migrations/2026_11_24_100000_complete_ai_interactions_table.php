<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Service IA (SCRUM-119 / F25) : fournisseur utilisé, version de l'utilisateur, détection d'un résumé périmé. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_interactions', function (Blueprint $table) {
            $table->string('provider', 50)->nullable();
            $table->string('model', 100)->nullable();
            $table->char('input_hash', 64)->nullable();
            $table->longText('edited_output')->nullable();
            $table->index(['feature', 'context']);
        });
    }

    public function down(): void
    {
        Schema::table('ai_interactions', function (Blueprint $table) {
            $table->dropIndex(['feature', 'context']);
            $table->dropColumn(['provider', 'model', 'input_hash', 'edited_output']);
        });
    }
};
