<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Comptes de démonstration (mot de passe : "password").
     * Les données métier (régions, catégories, produits…) arrivent avec SCRUM-17.
     */
    public function run(): void
    {
        User::factory()->admin()->create([
            'name' => 'Admin Marketplace',
            'email' => 'admin@marketplace.test',
        ]);

        User::factory()->supplier()->create([
            'name' => 'Fournisseur Démo',
            'email' => 'fournisseur@marketplace.test',
        ]);

        User::factory()->buyer()->create([
            'name' => 'Porteur Démo',
            'email' => 'porteur@marketplace.test',
        ]);
    }
}
