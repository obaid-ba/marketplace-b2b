<?php

namespace Database\Seeders;

use App\Enums\ProductStatus;
use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use App\Enums\UserStatus;
use App\Enums\ValidationStatus;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Laissez à false pour garder les tables métier vides au démarrage.
     * Passez à true pour insérer les données de test Jira (96+ lignes).
     * Les données de référence (régions, catégories) sont toujours insérées :
     * les formulaires d'inscription ne fonctionnent pas sans elles.
     */
    public const SEED_DEMO_DATA = false;

    public function run(): void
    {
        $now = now();

        // Données de référence. Idempotent : un second `db:seed` ne crée pas de doublons.
        $regionIds = $this->seedRegions($now);
        $subCategoryIds = $this->seedCategories($now);

        if (! self::SEED_DEMO_DATA) {
            return;
        }

        $password = Hash::make('password'); // Règle #7 : mot de passe « password »

        // 3. Administrateur (admin@marketplace.test)
        $adminId = DB::table('users')->insertGetId([
            'name' => 'Admin Marketplace',
            'email' => 'admin@marketplace.test',
            'phone' => '+216 71 000 000',
            'password' => $password,
            'role' => 'admin',
            'status' => UserStatus::ACTIVE->value,
            'email_verified_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        // 4. 8 Fournisseurs (6 validés, 1 en attente, 1 refusé avec motif)
        $supplierIds = [];
        for ($i = 1; $i <= 8; $i++) {
            $userId = DB::table('users')->insertGetId([
                'name' => "Fournisseur {$i}",
                'email' => "supplier{$i}@marketplace.test",
                'phone' => "+216 71 100 00{$i}",
                'password' => $password,
                'role' => 'supplier',
                'status' => UserStatus::ACTIVE->value,
                'email_verified_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $validationStatus = match ($i) {
                7 => ValidationStatus::PENDING->value,
                8 => ValidationStatus::REJECTED->value,
                default => ValidationStatus::VALIDATED->value,
            };

            $supplierIds[] = DB::table('supplier_profiles')->insertGetId([
                'user_id' => $userId,
                'company_name' => "Société Fournisseur {$i} SARL",
                'description' => "Fournisseur B2B spécialisé n°{$i}",
                'sector' => 'Industrie & Services',
                'region_id' => $regionIds[$i % count($regionIds)],
                'contact' => "contact@supplier{$i}.tn",
                'is_published' => $validationStatus === ValidationStatus::VALIDATED->value,
                'validation_status' => $validationStatus,
                'rejection_reason' => $i === 8 ? 'Registre de commerce expiré' : null,
                'validated_by' => $validationStatus !== ValidationStatus::PENDING->value ? $adminId : null,
                'validated_at' => $validationStatus !== ValidationStatus::PENDING->value ? $now : null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // 5. 5 Porteurs de projet (Buyers)
        $buyerIds = [];
        for ($i = 1; $i <= 5; $i++) {
            $userId = DB::table('users')->insertGetId([
                'name' => "Porteur {$i}",
                'email' => "buyer{$i}@marketplace.test",
                'phone' => "+216 71 200 00{$i}",
                'password' => $password,
                'role' => 'buyer',
                'status' => UserStatus::ACTIVE->value,
                'email_verified_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $buyerIds[] = DB::table('buyer_profiles')->insertGetId([
                'user_id' => $userId,
                'organization' => "Entreprise Acheteuse {$i} SA",
                'sector' => "Secteur {$i}",
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // 6. 40 Produits (publiés, brouillons et retirés, avec photos)
        for ($i = 1; $i <= 40; $i++) {
            $status = match (true) {
                $i <= 30 => ProductStatus::PUBLISHED->value,
                $i <= 36 => ProductStatus::DRAFT->value,
                default => ProductStatus::WITHDRAWN->value,
            };

            $productId = DB::table('products')->insertGetId([
                'supplier_id' => $supplierIds[$i % 6],
                'category_id' => $subCategoryIds[$i % count($subCategoryIds)],
                'type' => $i % 5 === 0 ? 'service' : 'produit',
                'title' => "Produit / Service B2B #{$i}",
                'description' => "Description détaillée de l'offre B2B #{$i}",
                'price' => rand(50, 5000),
                'unit' => 'unité',
                'stock' => rand(10, 200),
                'availability_days' => rand(1, 15),
                'status' => $status,
                'withdrawal_reason' => $status === ProductStatus::WITHDRAWN->value ? 'Rupture de stock temporaire' : null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('product_images')->insert([
                'product_id' => $productId,
                'path' => "products/demo-{$i}.jpg",
                'position' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // 7. 10 Demandes (Tenders) avec destinataires et devis sur certaines
        for ($i = 1; $i <= 10; $i++) {
            $tenderId = DB::table('tenders')->insertGetId([
                'buyer_id' => $buyerIds[$i % count($buyerIds)],
                'title' => "Demande d'approvisionnement #{$i}",
                'description' => "Cahier des charges pour la demande #{$i}",
                'category_id' => $subCategoryIds[$i % count($subCategoryIds)],
                'region_id' => $regionIds[$i % count($regionIds)],
                'budget' => rand(1000, 25000),
                'desired_deadline' => now()->addDays(rand(15, 60))->toDateString(),
                'status' => $i <= 7 ? TenderStatus::OPEN->value : TenderStatus::IN_NEGOTIATION->value,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            // Diffusion à 2 fournisseurs + 1 devis sur les 5 premières demandes
            foreach ([0, 1] as $sIdx) {
                DB::table('tender_recipients')->insert([
                    'tender_id' => $tenderId,
                    'supplier_id' => $supplierIds[$sIdx],
                    'score' => 85.50,
                    'source' => 'automatique',
                    'notified_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            if ($i <= 5) {
                DB::table('quotes')->insert([
                    'tender_id' => $tenderId,
                    'supplier_id' => $supplierIds[0],
                    'amount' => rand(900, 20000),
                    'delivery_days' => rand(5, 20),
                    'conditions' => 'Paiement à la commande',
                    'comment' => "Proposition commerciale pour la demande #{$i}",
                    'status' => QuoteStatus::SENT->value,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    /**
     * Les 24 gouvernorats tunisiens. Ne réinsère rien si les régions existent déjà.
     *
     * @return list<int>
     */
    private function seedRegions(\DateTimeInterface $now): array
    {
        if (DB::table('regions')->exists()) {
            return DB::table('regions')->pluck('id')->all();
        }

        $regions = [
            'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa',
            'Jendouba', 'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia',
            'La Manouba', 'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid',
            'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
        ];

        $regionIds = [];
        foreach ($regions as $name) {
            $regionIds[] = DB::table('regions')->insertGetId([
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        return $regionIds;
    }

    /**
     * Catégories principales et sous-catégories utilisées par les formulaires.
     * Ne réinsère rien si des catégories existent déjà.
     *
     * @return list<int>
     */
    private function seedCategories(\DateTimeInterface $now): array
    {
        if (DB::table('categories')->exists()) {
            return DB::table('categories')->whereNotNull('parent_id')->pluck('id')->all();
        }

        $categoriesTree = [
            'BTP et matériaux' => ['Ciment et béton', 'Acier et ferraillage', 'Électricité bâtiment', 'Plomberie et sanitaire'],
            'Informatique' => ['Ordinateurs et serveurs', 'Réseaux et sécurité', 'Développement logiciel', 'Périphériques'],
            'Fournitures de bureau' => ['Papeterie', 'Mobilier de bureau', 'Consommables impression'],
            'Agroalimentaire' => ['Matières premières', 'Conditionnement alimentaire', 'Produits laitiers et dérivés'],
            'Textile' => ['Tissus industriels', 'Vêtements de travail et EPI', 'Accessoires textiles'],
            'Services' => ['Comptabilité et audit', 'Conseil juridique', 'Nettoyage et gardiennage', 'Formation'],
            'Équipements industriels' => ['Machines-outils', 'Pièces de rechange', 'Maintenance industrielle'],
            'Logistique et transport' => ['Transport routier', 'Entreposage', 'Manutention et levage'],
        ];

        $subCategoryIds = [];
        $pos = 1;
        foreach ($categoriesTree as $parentName => $children) {
            $parentId = DB::table('categories')->insertGetId([
                'parent_id' => null,
                'name' => $parentName,
                'position' => $pos++,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $subPos = 1;
            foreach ($children as $childName) {
                $subCategoryIds[] = DB::table('categories')->insertGetId([
                    'parent_id' => $parentId,
                    'name' => $childName,
                    'position' => $subPos++,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        return $subCategoryIds;
    }
}
