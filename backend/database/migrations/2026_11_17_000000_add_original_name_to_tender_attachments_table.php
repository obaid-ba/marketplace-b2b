<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Conserve le nom d'origine du fichier envoyé par le porteur : le disque
     * stocke un nom aléatoire, l'interface doit afficher le nom lisible.
     */
    public function up(): void
    {
        Schema::table('tender_attachments', function (Blueprint $table) {
            $table->string('original_name')->nullable()->after('file_path');
        });
    }

    public function down(): void
    {
        Schema::table('tender_attachments', function (Blueprint $table) {
            $table->dropColumn('original_name');
        });
    }
};
