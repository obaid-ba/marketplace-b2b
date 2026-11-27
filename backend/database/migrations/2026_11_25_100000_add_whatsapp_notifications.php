<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Notifications WhatsApp (SCRUM-133) : consentement, troisième canal des préférences, suivi des envois. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->timestamp('whatsapp_opted_in_at')->nullable());

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_channel_check');
            DB::statement("ALTER TABLE notification_preferences ALTER COLUMN channel TYPE varchar(255), ALTER COLUMN channel SET NOT NULL");
        } else {
            Schema::table('notification_preferences', fn (Blueprint $table) => $table->enum('channel', ['email', 'site', 'whatsapp'])->change());
        }

        // Ni numéro ni texte : seulement ce qu'il faut pour suivre les envois et les replis.
        Schema::create('whatsapp_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('event_type');
            $table->enum('status', ['envoyé', 'simulé', 'échoué']);
            $table->boolean('email_fallback')->default(false);
            $table->string('provider', 50);
            $table->string('provider_message_id')->nullable();
            $table->string('error')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_deliveries');
        DB::table('notification_preferences')->where('channel', 'whatsapp')->delete();
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_channel_check');
            DB::statement("ALTER TABLE notification_preferences ALTER COLUMN channel TYPE varchar(255), ALTER COLUMN channel SET NOT NULL");
        } else {
            Schema::table('notification_preferences', fn (Blueprint $table) => $table->enum('channel', ['email', 'site'])->change());
        }
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('whatsapp_opted_in_at'));
    }
};
