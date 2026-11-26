<?php

use App\Enums\OrderStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Ajoute 'expédiée' et les statuts du cycle de vie aux colonnes status de orders et order_status_history.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            $values = "'" . implode("', '", OrderStatus::values()) . "'";
            DB::statement("ALTER TABLE `orders` MODIFY COLUMN `status` ENUM({$values}) NOT NULL DEFAULT 'validée'");
            DB::statement("ALTER TABLE `order_status_history` MODIFY COLUMN `status` ENUM({$values}) NOT NULL");
        }
    }

    public function down(): void
    {
        // En cas de rollback sur MySQL, pas de contrainte bloquante requise.
    }
};
