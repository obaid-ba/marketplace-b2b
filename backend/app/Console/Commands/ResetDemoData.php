<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Recrée la base avec les données de démonstration (photos comprises), une seule fois par jeton.
 *
 * Appelée au démarrage du conteneur (deploy/api/entrypoint.sh) quand RESET_DEMO_TOKEN est défini.
 * Le jeton appliqué est enregistré dans deployment_markers : les redémarrages suivants ne touchent
 * plus à la base. Pour réinitialiser à nouveau, il suffit de changer la valeur du jeton.
 *
 * ATTENTION : efface toutes les tables (comptes, commandes, messages…).
 */
class ResetDemoData extends Command
{
    protected $signature = 'demo:reset {token : identifiant de cette réinitialisation} {--force : obligatoire en production}';

    protected $description = 'Efface la base et la recrée avec les données de démonstration (une fois par jeton)';

    private const MARKER = 'demo_reset';

    public function handle(): int
    {
        $token = trim((string) $this->argument('token'));

        if ($token === '') {
            $this->error('Jeton vide : rien à faire.');

            return self::FAILURE;
        }

        if ($this->alreadyApplied($token)) {
            $this->info("Réinitialisation « {$token} » déjà appliquée : base conservée.");

            return self::SUCCESS;
        }

        if (app()->isProduction() && ! $this->option('force')) {
            $this->error('En production, ajoutez --force.');

            return self::FAILURE;
        }

        // Données de référence (régions, catégories) puis la démonstration complète avec photos :
        // même contenu que la démo locale, sans les lignes de test génériques du seeder Jira.
        config(['app.seed_demo_data' => false]);

        $this->info("Réinitialisation « {$token} » : migrate:fresh puis données de démonstration…");
        $this->call('migrate:fresh', ['--force' => true]);
        $this->call('db:seed', ['--force' => true]);
        $this->call('db:seed', ['--class' => \Database\Seeders\FullDemoSeeder::class, '--force' => true]);

        DB::table('deployment_markers')->updateOrInsert(
            ['key' => self::MARKER],
            ['value' => $token, 'applied_at' => now()],
        );

        $this->info('Base recréée.');

        return self::SUCCESS;
    }

    private function alreadyApplied(string $token): bool
    {
        return Schema::hasTable('deployment_markers')
            && DB::table('deployment_markers')->where('key', self::MARKER)->value('value') === $token;
    }
}
