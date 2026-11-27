<?php

use App\Services\AnomalyDetector;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Comptes et commandes au comportement inhabituel (SCRUM-86). Planifié toutes les 15 minutes
// (à lancer en production avec « php artisan schedule:work » ou une tâche cron « schedule:run »).
Artisan::command('anomalies:detect', function (AnomalyDetector $detector) {
    $this->info($detector->run().' alerte(s) créée(s) ou mise(s) à jour.');
})->purpose('Détecte les comptes et commandes au comportement inhabituel');

Schedule::command('anomalies:detect')->everyFifteenMinutes()->withoutOverlapping();
