<?php

use App\Enums\AnomalyStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Entité 29 : ai_interactions
        Schema::create('ai_interactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('feature');
            $table->string('context')->nullable();
            $table->longText('input')->nullable();
            $table->longText('output')->nullable();
            $table->boolean('accepted')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'feature']);
        });

        // Entité 30 : anomaly_alerts
        Schema::create('anomaly_alerts', function (Blueprint $table) {
            $table->id();
            $table->enum('target_type', ['compte', 'commande']);
            $table->unsignedBigInteger('target_id');
            $table->string('anomaly_type');
            $table->decimal('score', 5, 2)->default(0);
            $table->enum('status', AnomalyStatus::values())->default(AnomalyStatus::NEW->value)->index();
            $table->timestamps();
            $table->index(['target_type', 'target_id']);
        });

        // Entité 31 : audit_logs (non modifiable : uniquement created_at)
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('users')->restrictOnDelete();
            $table->string('action');
            $table->string('target');
            $table->text('reason')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('anomaly_alerts');
        Schema::dropIfExists('ai_interactions');
    }
};