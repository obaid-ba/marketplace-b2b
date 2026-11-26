<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Sprint 5 : pièces jointes et tri de la messagerie (SCRUM-59, 60), précisions d'un signalement d'avis (SCRUM-66). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->timestamp('last_message_at')->nullable()->index();
        });

        // Lecture repérée par l'identifiant du dernier message lu (last_read_at garde la date affichable).
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->unsignedBigInteger('last_read_message_id')->nullable()->after('last_read_at');
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->string('attachment_name')->nullable()->after('attachment_path');
            $table->string('attachment_mime', 150)->nullable()->after('attachment_name');
            $table->unsignedBigInteger('attachment_size')->nullable()->after('attachment_mime');
        });

        Schema::table('review_reports', function (Blueprint $table) {
            $table->text('details')->nullable()->after('reason');
        });
    }

    public function down(): void
    {
        Schema::table('review_reports', fn (Blueprint $table) => $table->dropColumn('details'));
        Schema::table('messages', fn (Blueprint $table) => $table->dropColumn(['attachment_name', 'attachment_mime', 'attachment_size']));
        Schema::table('conversation_participants', fn (Blueprint $table) => $table->dropColumn('last_read_message_id'));
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropIndex(['last_message_at']);
            $table->dropColumn('last_message_at');
        });
    }
};
