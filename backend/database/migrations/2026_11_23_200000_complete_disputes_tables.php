<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Litiges (SCRUM-117 / F23) : date de décision, nom et type des pièces jointes. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('disputes', fn (Blueprint $table) => $table->timestamp('decided_at')->nullable());

        Schema::table('dispute_attachments', function (Blueprint $table) {
            $table->string('original_name')->nullable();
            $table->string('mime', 150)->nullable();
            $table->unsignedBigInteger('size')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('dispute_attachments', fn (Blueprint $table) => $table->dropColumn(['original_name', 'mime', 'size']));

        Schema::table('disputes', fn (Blueprint $table) => $table->dropColumn('decided_at'));
    }
};
