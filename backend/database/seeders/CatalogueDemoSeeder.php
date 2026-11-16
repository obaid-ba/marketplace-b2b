<?php

namespace Database\Seeders;

use App\Enums\ProductStatus;
use App\Enums\UserStatus;
use App\Enums\ValidationStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\Region;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Données de démonstration du catalogue (sprint 2) : fournisseurs et produits des maquettes V1 à V4.
 * Mot de passe de tous les comptes : « password ».
 *
 *   php artisan db:seed --class=CatalogueDemoSeeder
 *
 * Idempotent : peut être relancé sans créer de doublons. Appelé par DatabaseSeeder si SEED_DEMO_DATA = true.
 */
class CatalogueDemoSeeder extends Seeder
{
    /**
     * Fournisseurs : [entreprise, e-mail, région, secteur, note, nombre d'avis, présentation, catégories proposées].
     */
    private const SUPPLIERS = [
        ['Atlas Emballages', 'atlas@marketplace.test', 'Sfax', 'Emballage et conditionnement', 4.6, 38,
            'Spécialiste des emballages en carton ondulé depuis 2009. 60 employés, capacité de 2 millions de pièces par mois, livraison dans toute la Tunisie.',
            ['Emballage et conditionnement', 'Logistique et transport']],
        ['Djerba Pack', 'djerbapack@marketplace.test', 'Médenine', 'Emballage et conditionnement', 4.3, 21,
            'Palettes et emballages bois pour l\'export, fabriqués à Djerba.', ['Emballage et conditionnement']],
        ['PalettesPlus', 'palettesplus@marketplace.test', 'Tunis', 'Logistique et transport', 4.8, 54,
            'Location et vente de palettes, services de palettisation sur site.', ['Logistique et transport']],
        ['Oliveraie du Sahel', 'oliveraie@marketplace.test', 'Sousse', 'Agroalimentaire', 4.7, 17,
            'Huile d\'olive extra vierge en vrac et conditionnée, certifiée bio.', ['Agroalimentaire']],
        ['TechNova Services', 'technova@marketplace.test', 'Tunis', 'Informatique et télécommunications', 4.5, 26,
            'Infogérance, maintenance de parcs informatiques et réseaux pour PME.', ['Informatique', 'Services']],
        ['ElectroSud', 'electrosud@marketplace.test', 'Gabès', 'Électricité et électronique', 4.2, 12,
            'Câbles et matériel électrique pour le bâtiment et l\'industrie.', ['BTP et matériaux']],
        ['MécaPro Industries', 'mecapro@marketplace.test', 'Sfax', 'Équipements industriels', 4.4, 9,
            'Machines d\'étiquetage et de conditionnement, installation et SAV.', ['Équipements industriels']],
    ];

    /**
     * Produits : [fournisseur, catégorie (principale ou sous-catégorie), type, titre, prix, unité, stock, délai (jours), description].
     */
    private const PRODUCTS = [
        ['Atlas Emballages', 'Conditionnement alimentaire', 'produit', 'Cartons ondulés sur mesure', 2.40, 'pièce', 12500, 5,
            'Cartons ondulés simple ou double cannelure, fabriqués selon vos dimensions et votre impression. Idéal pour l\'expédition de produits agroalimentaires, pièces industrielles et e-commerce. Livraison possible dans tout le pays, devis dégressif à partir de 5 000 pièces.'],
        ['Atlas Emballages', 'Conditionnement alimentaire', 'produit', 'Boîtes pliantes alimentaires', 0.85, 'pièce', 40000, 7,
            'Boîtes pliantes en carton compact, aptes au contact alimentaire, impression offset jusqu\'à 4 couleurs.'],
        ['Atlas Emballages', 'Manutention et levage', 'produit', 'Film étirable 500 mm', 12, 'rouleau', 3400, 2,
            'Film étirable manuel 23 microns, rouleau de 300 m, transparent.'],
        ['Atlas Emballages', 'Entreposage', 'service', 'Service de palettisation', 350, 'jour', null, 2,
            'Équipe de deux opérateurs pour la palettisation et le filmage de vos marchandises sur site.'],
        ['Djerba Pack', 'Manutention et levage', 'produit', 'Palettes bois EPAL', 18, 'unité', 1200, 7,
            'Palettes EPAL 1200 x 800 neuves, traitement NIMP 15 pour l\'export.'],
        ['Djerba Pack', 'Conditionnement alimentaire', 'produit', 'Sacs kraft 25 kg', 1.60, 'pièce', 25000, 7,
            'Sacs kraft 3 plis à valve pour farine, semoule et aliments du bétail.'],
        ['PalettesPlus', 'Manutention et levage', 'produit', 'Palettes plastique alimentaires', 45, 'unité', 600, 2,
            'Palettes en polyéthylène lavables, conformes à l\'usage alimentaire.'],
        ['PalettesPlus', 'Transport routier', 'service', 'Transport de palettes Tunis - Sfax', 220, 'palette', null, 2,
            'Messagerie palettisée entre le Grand Tunis et Sfax, enlèvement sous 24 h.'],
        ['Oliveraie du Sahel', 'Matières premières', 'produit', 'Huile d\'olive en vrac', 14, 'litre', 50000, 7,
            'Huile d\'olive extra vierge, acidité inférieure à 0,5 %, livrée en citerne ou en cubis de 1 000 L.'],
        ['Oliveraie du Sahel', 'Produits laitiers et dérivés', 'produit', 'Fromage frais en seau 5 kg', 32, 'seau', 800, 2,
            'Fromage frais au lait de vache pour la restauration collective.'],
        ['TechNova Services', 'Réseaux et sécurité', 'service', 'Maintenance parc informatique', 800, 'mois', null, 7,
            'Contrat de maintenance préventive et curative pour 20 postes, intervention sur site sous 4 h.'],
        ['TechNova Services', 'Développement logiciel', 'service', 'Développement d\'application métier', 450, 'jour', null, 30,
            'Développement web et mobile sur mesure : gestion de stock, CRM, portail client.'],
        ['TechNova Services', 'Ordinateurs et serveurs', 'produit', 'Serveur rack 1U reconditionné', 2900, 'unité', 14, 7,
            'Serveur rack 1U, 2 processeurs 8 cœurs, 64 Go de RAM, garanti 1 an.'],
        ['ElectroSud', 'Électricité bâtiment', 'produit', 'Câbles électriques 2,5 mm²', 95, 'rouleau', 900, 2,
            'Câble H07V-U 2,5 mm², rouleau de 100 m, conforme NF.'],
        ['ElectroSud', 'Électricité bâtiment', 'produit', 'Tableau électrique 4 rangées', 310, 'unité', 75, 7,
            'Coffret modulaire 4 rangées de 13 modules, avec porte et borniers.'],
        ['MécaPro Industries', 'Machines-outils', 'produit', 'Étiqueteuse automatique', 12400, null, 3, 30,
            'Étiqueteuse automatique pour flacons ronds, cadence 3 000 unités / heure, installation incluse.'],
        ['MécaPro Industries', 'Maintenance industrielle', 'service', 'Maintenance de lignes de conditionnement', 600, 'jour', null, 7,
            'Intervention de techniciens qualifiés pour la maintenance préventive de vos lignes.'],
    ];

    public function run(): void
    {
        $password = Hash::make('password');

        $suppliers = [];
        foreach (self::SUPPLIERS as [$company, $email, $regionName, $sector, $rating, $reviews, $description, $categoryNames]) {
            $user = User::query()->firstOrCreate(['email' => $email], [
                'name' => $company,
                'password' => $password,
                'role' => 'supplier',
                'status' => UserStatus::ACTIVE->value,
                'email_verified_at' => now(),
            ]);

            $profile = SupplierProfile::query()->updateOrCreate(['user_id' => $user->id], [
                'company_name' => $company,
                'description' => $description,
                'sector' => $sector,
                'region_id' => Region::query()->firstOrCreate(['name' => $regionName])->id,
                'professional_email' => $email,
                'is_published' => true,
                'validation_status' => ValidationStatus::VALIDATED,
                'validated_at' => now(),
            ]);
            // Réputation de démonstration (en production : recalculée à partir des avis, SCRUM-65).
            $profile->forceFill(['rating_avg' => $rating, 'reviews_count' => $reviews])->save();

            $profile->categories()->syncWithoutDetaching(
                collect($categoryNames)->map(fn (string $name) => $this->category($name)->id)->all(),
            );
            $profile->coverageRegions()->syncWithoutDetaching(
                Region::query()->whereIn('name', ['Sfax', 'Médenine', 'Gabès', 'Sousse', 'Tunis'])->pluck('id')->all(),
            );

            $suppliers[$company] = $profile;
        }

        foreach (self::PRODUCTS as $index => [$company, $categoryName, $type, $title, $price, $unit, $stock, $days, $description]) {
            Product::query()->updateOrCreate(
                ['supplier_id' => $suppliers[$company]->id, 'title' => $title],
                [
                    'category_id' => $this->category($categoryName)->id,
                    'type' => $type,
                    'description' => $description,
                    'price' => $price,
                    'unit' => $unit,
                    'stock' => $stock,
                    'availability_days' => $days,
                    'status' => ProductStatus::PUBLISHED,
                    // Les 4 premiers sont mis en avant sur la page d'accueil (SCRUM-38).
                    'featured_until' => $index < 4 ? now()->addMonth() : null,
                ],
            );
        }

        // Un brouillon et un produit retiré par l'administrateur, jamais visibles dans le catalogue.
        Product::query()->updateOrCreate(
            ['supplier_id' => $suppliers['Atlas Emballages']->id, 'title' => 'Sacs kraft 25 kg (brouillon)'],
            ['category_id' => $this->category('Conditionnement alimentaire')->id, 'type' => 'produit', 'price' => 1.6,
                'unit' => 'pièce', 'stock' => 0, 'availability_days' => 7, 'status' => ProductStatus::DRAFT],
        );
        Product::query()->updateOrCreate(
            ['supplier_id' => $suppliers['Atlas Emballages']->id, 'title' => 'Étiqueteuse X2'],
            ['category_id' => $this->category('Machines-outils')->id, 'type' => 'produit', 'price' => 9800,
                'unit' => null, 'stock' => 2, 'availability_days' => 30, 'status' => ProductStatus::WITHDRAWN,
                'withdrawal_reason' => 'Photos ne correspondant pas au produit décrit.'],
        );
    }

    /**
     * Catégorie existante (référentiel de DatabaseSeeder) ou créée en catégorie principale.
     */
    private function category(string $name): Category
    {
        return Category::query()->where('name', $name)->first()
            ?? Category::query()->create([
                'name' => $name,
                'parent_id' => null,
                'position' => (int) Category::query()->whereNull('parent_id')->max('position') + 1,
            ]);
    }
}
