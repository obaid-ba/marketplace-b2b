<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * PostgreSQL / TiDB : les colonnes `enum` de Laravel sont des varchar accompagnés
 * d'une contrainte CHECK. PostgresGrammar::compileChange() ne met pas cette contrainte
 * à jour quand la colonne est modifiée (`->change()`), et la migration qui ajoute une
 * valeur à un Enum PHP ne la touche pas non plus.
 *
 * On retire donc les contraintes devenues obsolètes :
 *   - notification_preferences.channel : ajout de "whatsapp" (SCRUM-133) ;
 *   - orders.status / order_status_history.status : ajout de "expédiée" (SCRUM-94).
 *
 * Les valeurs restent validées côté application par les Enums et les Form Requests.
 * Cette migration est idempotente : elle peut être rejouée à chaque démarrage sur Render.
 */
return new class extends Migration
{
    /** @var list<array{0: string, 1: string}> */
    private const LEGACY_CHECKS = [
        ['notification_preferences', 'notification_preferences_channel_check'],
        ['orders', 'orders_status_check'],
        ['order_status_history', 'order_status_history_status_check'],
    ];

    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        foreach (self::LEGACY_CHECKS as [$table, $constraint]) {
            if (Schema::hasTable($table)) {
                DB::statement("ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS {$constraint}");
            }
        }
    }

    public function down(): void
    {
        // Volontairement sans effet : restaurer un CHECK ancien ferait échouer les
        // données utilisant les nouvelles valeurs. Une migration corrective dédiée
        // est préférable à un rollback (cf. docs/DEPLOYMENT.md §7).
    }
};
