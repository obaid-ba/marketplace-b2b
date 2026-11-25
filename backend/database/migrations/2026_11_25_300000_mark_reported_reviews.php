<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Avis déjà signalés et pas encore examinés : statut « signalé » (SCRUM-66). Ils restent visibles. */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('reviews')
            ->where('status', 'publié')
            ->whereIn('id', DB::table('review_reports')->where('status', 'en attente')->select('review_id'))
            ->update(['status' => 'signalé']);
    }

    public function down(): void
    {
        DB::table('reviews')->where('status', 'signalé')->update(['status' => 'publié']);
    }
};
