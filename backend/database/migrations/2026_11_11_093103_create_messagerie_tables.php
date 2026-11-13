<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Entité 16 : conversations
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('buyer_id')->constrained('buyer_profiles')->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained('supplier_profiles')->cascadeOnDelete();
            $table->enum('context_type', ['demande', 'devis', 'commande', 'direct'])->default('direct');
            $table->unsignedBigInteger('context_id')->nullable();
            $table->timestamps();
            $table->index(['context_type', 'context_id']);
        });

        // Entité 17 : conversation_participants
        Schema::create('conversation_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('last_read_at')->nullable();
            $table->timestamps();
            $table->unique(['conversation_id', 'user_id']);
        });

        // Entité 18 : messages
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->string('attachment_path')->nullable();
            $table->timestamp('sent_at')->useCurrent();
            $table->timestamps();
        });

        // Entité 19 : notifications (Règle #6 : table native Laravel)
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversation_participants');
        Schema::dropIfExists('conversations');
    }
};