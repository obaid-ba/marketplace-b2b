<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Indicateurs choisis pour un export (SCRUM-75) ; null = tous. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exports', fn (Blueprint $table) => $table->json('indicators')->nullable());
    }

    public function down(): void
    {
        Schema::table('exports', fn (Blueprint $table) => $table->dropColumn('indicators'));
    }
};
