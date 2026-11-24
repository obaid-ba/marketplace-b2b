<?php

use App\Enums\DisputeDecision;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Fusion S5 / S6 : données enregistrées par la première version S6 des litiges et de l'IA.
 * Aucune information n'est perdue ; sans données de ce type, la migration ne change rien.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Décision en texte libre : conservée dans la note, aucune décision de la liste n'est inventée.
        DB::table('disputes')
            ->whereNotNull('decision')
            ->whereNotIn('decision', DisputeDecision::values())
            ->eachById(fn (object $dispute) => DB::table('disputes')->where('id', $dispute->id)->update([
                'decision' => null,
                'decision_note' => trim("Décision : {$dispute->decision}\n\n{$dispute->decision_note}"),
            ]));

        DB::table('disputes')->where('status', 'décidé')->whereNull('decided_at')->update(['decided_at' => DB::raw('updated_at')]);

        DB::table('dispute_attachments')->whereNull('original_name')->eachById(
            fn (object $file) => DB::table('dispute_attachments')->where('id', $file->id)->update(['original_name' => basename($file->file_path)])
        );

        foreach (['tender_draft' => 'rédaction', 'product_text' => 'rédaction', 'quote_summary' => 'résumé de devis'] as $old => $feature) {
            DB::table('ai_interactions')->where('feature', $old)->eachById(
                fn (object $row) => DB::table('ai_interactions')->where('id', $row->id)->update([
                    'feature' => $old === 'product_text' && str_starts_with((string) $row->context, 'Reformulation') ? 'reformulation' : $feature,
                    'input' => json_encode(['text' => $row->input], JSON_THROW_ON_ERROR),
                    'output' => json_encode(['text' => $row->output], JSON_THROW_ON_ERROR),
                    'provider' => 'simulated',
                ])
            );
        }
    }

    public function down(): void
    {
        // Les données converties restent valides.
    }
};
