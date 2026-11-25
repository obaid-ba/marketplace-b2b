<?php

namespace Database\Seeders;

use App\Enums\ConversationContext;
use App\Enums\DisputeDecision;
use App\Enums\DisputeReason;
use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\ReviewStatus;
use App\Enums\UserStatus;
use App\Enums\ValidationStatus;
use App\Jobs\AnalyzeReviewJob;
use App\Models\BuyerProfile;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Quote;
use App\Models\Region;
use App\Models\Review;
use App\Models\ReviewReport;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\User;
use App\Services\AnomalyDetector;
use App\Services\ConversationService;
use App\Services\DisputeService;
use App\Services\OrderDocumentService;
use App\Services\QuoteService;
use App\Services\SupplierRatingService;
use App\Services\TenderService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

/**
 * Démonstration complète de TijaraLink : tous les écrans ont des données réalistes.
 *
 *   php artisan storage:link
 *   php artisan db:seed --class=FullDemoSeeder
 *
 * Contenu : 14 fournisseurs (dont un en attente et un refusé) avec logo, 42 produits et services avec photo
 * dans toutes les catégories, demandes ouvertes / acceptées / annulées avec devis, commandes à chaque étape
 * (devis et factures PDF), avis analysés par l'IA, litiges, messagerie, signalement d'avis, alerte d'anomalie,
 * notifications. Les données passent par les services de l'application : règles métier et notifications réelles.
 * Mot de passe de tous les comptes : « password ». Relançable : le scénario n'est créé qu'une fois.
 */
class FullDemoSeeder extends Seeder
{
    private const IMAGES = __DIR__.'/demo-images';

    /** Marqueur du scénario (demandes, commandes…) : présent = déjà créé. */
    private const SCENARIO_MARKER = 'Cartons pour l’export d’huile d’olive';

    /**
     * Nouveaux fournisseurs : [entreprise, e-mail, région, secteur, note, avis, présentation, catégories, logo, statut].
     */
    private const SUPPLIERS = [
        ['BatiSud Matériaux', 'batisud@marketplace.test', 'Sfax', 'BTP et matériaux', 4.5, 0,
            'Négoce de matériaux de construction : ciment, acier, plomberie. Livraison sur chantier dans le Sud.',
            ['Ciment et béton', 'Acier et ferraillage', 'Plomberie et sanitaire'], 'batisud', 'validé'],
        ['InfoStore Tunis', 'infostore@marketplace.test', 'Tunis', 'Informatique', 4.4, 0,
            'Matériel informatique professionnel, installation de réseaux et garantie sur site.',
            ['Ordinateurs et serveurs', 'Périphériques', 'Réseaux et sécurité'], 'infostore', 'validé'],
        ['BureauPlus', 'bureauplus@marketplace.test', 'Ariana', 'Fournitures de bureau', 4.6, 0,
            'Tout pour le bureau : papeterie, consommables d’impression et mobilier, livré en 48 h.',
            ['Papeterie', 'Mobilier de bureau', 'Consommables impression'], 'bureauplus', 'validé'],
        ['Oasis Dattes Tozeur', 'oasis@marketplace.test', 'Tozeur', 'Agroalimentaire', 4.8, 0,
            'Dattes Deglet Nour et produits céréaliers du Sud tunisien, conditionnés pour la distribution.',
            ['Matières premières'], 'oasis', 'validé'],
        ['TextilPro Monastir', 'textilpro@marketplace.test', 'Monastir', 'Textile', 4.3, 0,
            'Confection de vêtements de travail et d’équipements de protection, tissus techniques.',
            ['Vêtements de travail et EPI', 'Tissus industriels'], 'textilpro', 'validé'],
        ['Fidus Conseil', 'fidus@marketplace.test', 'Tunis', 'Services', 4.7, 0,
            'Cabinet d’expertise comptable, conseil juridique et formation des équipes.',
            ['Comptabilité et audit', 'Conseil juridique', 'Formation'], 'fidus', 'validé'],
        ['ProNet Services', 'pronet@marketplace.test', 'Sousse', 'Services', 4.1, 0,
            'Nettoyage professionnel et gardiennage de sites industriels et tertiaires.',
            ['Nettoyage et gardiennage'], 'pronet', 'validé'],
        ['Nouvelle Énergie SARL', 'nouvelleenergie@marketplace.test', 'Gabès', 'Énergie', 0, 0,
            'Installation de panneaux solaires pour entreprises (dossier en cours de vérification).',
            ['Électricité bâtiment'], null, 'en attente'],
        ['Import Express', 'importexpress@marketplace.test', 'Ben Arous', 'Import', 0, 0,
            'Import de matériel divers.', ['Pièces de rechange'], null, 'refusé'],
    ];

    /** Logos des fournisseurs du catalogue du sprint 2. */
    private const EXISTING_LOGOS = [
        'Atlas Emballages' => 'atlas', 'Djerba Pack' => 'djerba-pack', 'PalettesPlus' => 'palettesplus',
        'Oliveraie du Sahel' => 'oliveraie', 'TechNova Services' => 'technova', 'ElectroSud' => 'electrosud', 'MécaPro Industries' => 'mecapro',
    ];

    /** Catégories supplémentaires des fournisseurs existants (sous-catégories, pour la diffusion des demandes). */
    private const EXTRA_CATEGORIES = [
        'Atlas Emballages' => ['Conditionnement alimentaire', 'Entreposage', 'Manutention et levage'],
        'Djerba Pack' => ['Conditionnement alimentaire', 'Manutention et levage'],
        'PalettesPlus' => ['Manutention et levage', 'Entreposage', 'Transport routier'],
        'Oliveraie du Sahel' => ['Matières premières', 'Produits laitiers et dérivés'],
        'TechNova Services' => ['Réseaux et sécurité', 'Développement logiciel', 'Ordinateurs et serveurs'],
        'ElectroSud' => ['Électricité bâtiment'],
        'MécaPro Industries' => ['Machines-outils', 'Maintenance industrielle', 'Pièces de rechange'],
    ];

    /**
     * Nouveaux produits : [fournisseur, sous-catégorie, type, titre, prix, unité, stock, délai, description, image].
     */
    private const PRODUCTS = [
        ['BatiSud Matériaux', 'Ciment et béton', 'produit', 'Ciment CPJ 45 (sac de 50 kg)', 18.5, 'sac', 4000, 2,
            'Ciment Portland composé CPJ 45, conforme NT 47.01, idéal pour bétons courants et maçonnerie.', 'ciment'],
        ['BatiSud Matériaux', 'Acier et ferraillage', 'produit', 'Rond à béton HA12 (barre de 12 m)', 32, 'barre', 2500, 3,
            'Acier haute adhérence FeE500, barres de 12 m, livraison en botte sur chantier.', 'rond-a-beton'],
        ['BatiSud Matériaux', 'Plomberie et sanitaire', 'produit', 'Tubes PPR Ø25 (barre de 4 m)', 9.8, 'barre', 1800, 2,
            'Tubes polypropylène PN20 pour eau chaude et froide sanitaire.', 'tubes-ppr'],
        ['BatiSud Matériaux', 'Ciment et béton', 'service', 'Béton prêt à l’emploi C25/30', 230, 'm³', null, 1,
            'Livraison par camion toupie avec pompe en option, dans un rayon de 50 km autour de Sfax.', 'beton-pret'],
        ['InfoStore Tunis', 'Ordinateurs et serveurs', 'produit', 'Ordinateur portable professionnel 15"', 2450, 'unité', 40, 5,
            'Processeur 8 cœurs, 16 Go de RAM, SSD 512 Go, garantie 2 ans sur site.', 'ordinateur-portable'],
        ['InfoStore Tunis', 'Périphériques', 'produit', 'Imprimante laser multifonction', 890, 'unité', 25, 3,
            'Impression recto verso, scan et copie, réseau Wi-Fi, 40 pages par minute.', 'imprimante-laser'],
        ['InfoStore Tunis', 'Réseaux et sécurité', 'produit', 'Switch réseau 24 ports PoE', 640, 'unité', 18, 4,
            'Switch administrable 24 ports Gigabit PoE+ pour caméras et téléphones IP.', 'switch-reseau'],
        ['BureauPlus', 'Papeterie', 'produit', 'Ramette papier A4 80 g', 13.5, 'ramette', 6000, 2,
            'Papier blanc 80 g/m², 500 feuilles, compatible toutes imprimantes.', 'ramette-papier'],
        ['BureauPlus', 'Mobilier de bureau', 'produit', 'Fauteuil de bureau ergonomique', 420, 'unité', 60, 7,
            'Soutien lombaire réglable, accoudoirs 3D, assise en tissu respirant.', 'fauteuil-bureau'],
        ['BureauPlus', 'Consommables impression', 'produit', 'Cartouche toner noir haute capacité', 95, 'unité', 300, 2,
            'Toner compatible 6 000 pages, garanti sans fuite.', 'toner'],
        ['BureauPlus', 'Papeterie', 'produit', 'Classeurs à levier (lot de 10)', 39, 'lot', 450, 2,
            'Classeurs A4 dos 75 mm, couleurs assorties.', 'classeurs'],
        ['Oasis Dattes Tozeur', 'Matières premières', 'produit', 'Dattes Deglet Nour (carton de 5 kg)', 38, 'carton', 1200, 4,
            'Dattes branchées ou en vrac, calibre premium, récolte 2026.', 'dattes'],
        ['Oasis Dattes Tozeur', 'Matières premières', 'produit', 'Semoule fine (sac de 25 kg)', 29, 'sac', 900, 3,
            'Semoule de blé dur fine pour boulangerie et pâtisserie.', 'semoule'],
        ['TextilPro Monastir', 'Vêtements de travail et EPI', 'produit', 'Gilets haute visibilité', 12, 'pièce', 3000, 5,
            'Gilets jaunes classe 2, bandes rétroréfléchissantes, personnalisables avec votre logo.', 'gilets-haute-visibilite'],
        ['TextilPro Monastir', 'Vêtements de travail et EPI', 'produit', 'Tenue de travail 2 pièces', 85, 'tenue', 800, 10,
            'Veste et pantalon en polycoton 260 g, poches renforcées.', 'tenue-travail'],
        ['TextilPro Monastir', 'Tissus industriels', 'produit', 'Tissu coton sergé (rouleau de 50 m)', 410, 'rouleau', 120, 7,
            'Coton sergé 280 g, largeur 150 cm, coloris au choix.', 'tissu-coton'],
        ['Fidus Conseil', 'Comptabilité et audit', 'service', 'Audit comptable annuel', 3500, 'mission', null, 30,
            'Revue des comptes, rapport et recommandations, par des experts-comptables inscrits à l’Ordre.', 'audit-comptable'],
        ['Fidus Conseil', 'Conseil juridique', 'service', 'Rédaction de contrats commerciaux', 600, 'contrat', null, 7,
            'Contrats de vente, de distribution et de sous-traitance adaptés au droit tunisien.', 'contrats-commerciaux'],
        ['Fidus Conseil', 'Formation', 'service', 'Formation sécurité au travail', 1200, 'session', null, 14,
            'Session d’une journée pour 15 personnes : prévention des risques, gestes de premiers secours.', 'formation-securite'],
        ['ProNet Services', 'Nettoyage et gardiennage', 'service', 'Nettoyage de bureaux', 900, 'mois', null, 5,
            'Entretien quotidien de 500 m² de bureaux, produits écologiques fournis.', 'nettoyage-bureaux'],
        ['ProNet Services', 'Nettoyage et gardiennage', 'service', 'Gardiennage de site', 2800, 'mois', null, 7,
            'Agent de sécurité 24 h/24, rondes et contrôle des accès.', 'gardiennage'],
        ['MécaPro Industries', 'Pièces de rechange', 'produit', 'Roulements à billes 6205', 14, 'pièce', 900, 2,
            'Roulements étanches 2RS, marque européenne, pour moteurs et convoyeurs.', 'roulements'],
        ['MécaPro Industries', 'Machines-outils', 'produit', 'Compresseur d’air 100 L', 1650, 'unité', 12, 7,
            'Compresseur à piston 3 CV, 10 bars, cuve de 100 litres.', 'compresseur'],
        ['PalettesPlus', 'Entreposage', 'service', 'Stockage en entrepôt', 25, 'palette / mois', null, 1,
            'Entrepôt sécurisé de 4 000 m² à Ben Arous, gestion des entrées et sorties incluse.', 'stockage-entrepot'],
        ['PalettesPlus', 'Manutention et levage', 'service', 'Location de chariot élévateur', 180, 'jour', null, 2,
            'Chariot diesel 3 tonnes avec ou sans cariste, livré sur votre site.', 'chariot-elevateur'],
    ];

    /** Photos des produits du catalogue du sprint 2 (titre → fichier). */
    private const EXISTING_IMAGES = [
        'Cartons ondulés sur mesure' => 'cartons-ondules', 'Boîtes pliantes alimentaires' => 'boites-pliantes',
        'Film étirable 500 mm' => 'film-etirable', 'Service de palettisation' => 'palettisation', 'Palettes bois EPAL' => 'palettes-bois',
        'Sacs kraft 25 kg' => 'sacs-kraft', 'Palettes plastique alimentaires' => 'palettes-plastique',
        'Transport de palettes Tunis - Sfax' => 'transport-palettes', 'Huile d\'olive en vrac' => 'huile-olive',
        'Fromage frais en seau 5 kg' => 'fromage-frais', 'Maintenance parc informatique' => 'maintenance-informatique',
        'Développement d\'application métier' => 'application-metier', 'Serveur rack 1U reconditionné' => 'serveur-rack',
        'Câbles électriques 2,5 mm²' => 'cables-electriques', 'Tableau électrique 4 rangées' => 'tableau-electrique',
        'Étiqueteuse automatique' => 'etiqueteuse', 'Maintenance de lignes de conditionnement' => 'maintenance-lignes',
    ];

    private string $password;

    private User $admin;

    /** @var array<string, SupplierProfile> */
    private array $suppliers = [];

    public function run(): void
    {
        // Pendant le seeding : tâches exécutées tout de suite, pas de temps réel ni de vrai e-mail.
        config(['queue.default' => 'sync', 'broadcasting.default' => 'log', 'mail.default' => 'log']);

        $this->call(CatalogueDemoSeeder::class);
        $this->password = Hash::make('password');

        $this->admin = User::query()->firstOrCreate(['email' => 'admin@marketplace.test'], [
            'name' => 'Équipe TijaraLink', 'first_name' => 'Équipe', 'last_name' => 'TijaraLink', 'password' => $this->password,
            'role' => 'admin', 'status' => UserStatus::ACTIVE->value, 'email_verified_at' => now(),
        ]);

        $this->seedSuppliers();
        $this->seedProducts();
        $this->seedImagesAndLogos();

        if (Tender::query()->where('title', self::SCENARIO_MARKER)->exists()) {
            $this->command?->info('Scénario déjà présent : fiches, images et avis complémentaires mis à jour.');
        } else {
            $this->seedScenario();
        }

        $this->seedExtraReviews();
    }

    /**
     * Avis positifs des nouveaux fournisseurs (relançable : un avis par commentaire), pour que chacun ait une note
     * réaliste et non seulement l'avis suspect de la démonstration.
     */
    private function seedExtraReviews(): void
    {
        $karim = $this->buyer('karim@marketplace.test', 'Karim', 'Trabelsi', 'Chantiers Trabelsi');
        $leila = $this->buyer('leila@marketplace.test', 'Leila', 'Mansour', 'Cabinet Mansour');

        $reviews = [
            [$karim, 'Rond à béton HA12 (barre de 12 m)', 80, 5, 'Acier conforme, livré sur le chantier à l’heure prévue. Très bon fournisseur.'],
            [$leila, 'Tubes PPR Ø25 (barre de 4 m)', 120, 4, 'Bonne qualité et prix correct, livraison rapide à Sfax.'],
            [$karim, 'Gilets haute visibilité', 50, 4, 'Gilets solides, bon rapport qualité-prix.'],
            [$leila, 'Rédaction de contrats commerciaux', 1, 5, 'Équipe réactive et contrats clairs, je recommande.'],
            [$karim, 'Nettoyage de bureaux', 1, 4, 'Service sérieux et ponctuel.'],
            [$leila, 'Dattes Deglet Nour (carton de 5 kg)', 20, 5, 'Dattes excellentes, très appréciées par nos clients.'],
            [$karim, 'Switch réseau 24 ports PoE', 2, 4, 'Matériel conforme, installation rapide.'],
        ];

        foreach ($reviews as [$buyer, $title, $quantity, $rating, $comment]) {
            if (Review::query()->where('comment', $comment)->exists()) {
                continue;
            }
            $order = $this->catalogueOrder($buyer, $this->product($title), $quantity, OrderStatus::DELIVERED, random_int(20, 50));
            $this->close($order, random_int(5, 15));
            $this->review($order, $rating, $comment, null);
        }
    }

    private function seedSuppliers(): void
    {
        foreach (SupplierProfile::query()->with('user')->get() as $profile) {
            $this->suppliers[$profile->company_name] = $profile;
        }

        foreach (self::EXTRA_CATEGORIES as $company => $categories) {
            $this->suppliers[$company]?->categories()->syncWithoutDetaching($this->categoryIds($categories));
        }

        foreach (self::SUPPLIERS as [$company, $email, $regionName, $sector, $rating, $reviews, $description, $categories, $logo, $status]) {
            $user = User::query()->firstOrCreate(['email' => $email], [
                'name' => $company, 'password' => $this->password, 'role' => 'supplier',
                'status' => UserStatus::ACTIVE->value, 'email_verified_at' => now(),
            ]);

            $validated = $status === 'validé';
            $profile = SupplierProfile::query()->updateOrCreate(['user_id' => $user->id], [
                'company_name' => $company,
                'description' => $description,
                'sector' => $sector,
                'region_id' => Region::query()->firstOrCreate(['name' => $regionName])->id,
                'professional_email' => $email,
                'is_published' => $validated,
                'validation_status' => match ($status) {
                    'validé' => ValidationStatus::VALIDATED,
                    'refusé' => ValidationStatus::REJECTED,
                    default => ValidationStatus::PENDING,
                },
                'rejection_reason' => $status === 'refusé' ? 'Registre de commerce illisible et matricule fiscal ne correspondant pas à la raison sociale.' : null,
                'validated_by' => $status === 'en attente' ? null : $this->admin->id,
                'validated_at' => $status === 'en attente' ? null : now()->subDays(20),
            ]);
            $profile->forceFill(['rating_avg' => $rating, 'reviews_count' => $reviews])->save();
            $profile->categories()->syncWithoutDetaching($this->categoryIds($categories));
            $profile->coverageRegions()->syncWithoutDetaching(
                Region::query()->whereIn('name', [$regionName, 'Tunis', 'Sfax', 'Sousse', 'Médenine', 'Nabeul'])->pluck('id')->all(),
            );

            $this->suppliers[$company] = $profile->load('user');
        }
    }

    private function seedProducts(): void
    {
        foreach (self::PRODUCTS as $index => [$company, $category, $type, $title, $price, $unit, $stock, $days, $description, $image]) {
            Product::query()->updateOrCreate(
                ['supplier_id' => $this->suppliers[$company]->id, 'title' => $title],
                [
                    'category_id' => $this->categoryIds([$category])[0],
                    'type' => $type,
                    'description' => $description,
                    'price' => $price,
                    'unit' => $unit,
                    'stock' => $stock,
                    'availability_days' => $days,
                    'status' => ProductStatus::PUBLISHED,
                    // Quelques nouveautés mises en avant (SCRUM-40).
                    'featured_until' => in_array($index, [0, 4, 11, 13], true) ? now()->addDays(14) : null,
                ],
            );
        }
    }

    /**
     * Photos de tous les produits publiés et logos des fournisseurs, copiés sur le disque public.
     */
    private function seedImagesAndLogos(): void
    {
        $files = collect(self::PRODUCTS)->mapWithKeys(fn (array $row) => [$row[3] => $row[9]])->merge(self::EXISTING_IMAGES);

        foreach (Product::query()->whereIn('title', $files->keys())->get() as $product) {
            $path = "products/demo/{$files[$product->title]}.jpg";
            Storage::disk(ProductImage::DISK)->put($path, file_get_contents(self::IMAGES."/products/{$files[$product->title]}.jpg"));
            ProductImage::query()->firstOrCreate(['product_id' => $product->id, 'path' => $path], ['position' => 1]);
        }

        $logos = collect(self::SUPPLIERS)->filter(fn (array $row) => $row[8])->mapWithKeys(fn (array $row) => [$row[0] => $row[8]])->merge(self::EXISTING_LOGOS);

        foreach ($logos as $company => $file) {
            if (! isset($this->suppliers[$company])) {
                continue;
            }
            $path = "supplier-logos/demo/{$file}.png";
            Storage::disk('public')->put($path, file_get_contents(self::IMAGES."/logos/{$file}.png"));
            $this->suppliers[$company]->forceFill(['logo' => $path])->save();
        }
    }

    /**
     * Demandes, devis, commandes à chaque étape, avis, litiges, messagerie, signalement, anomalie.
     */
    private function seedScenario(): void
    {
        $sana = $this->buyer('sana@marketplace.test', 'Sana', 'Ben Salah', 'Huilerie du Sahel');
        $karim = $this->buyer('karim@marketplace.test', 'Karim', 'Trabelsi', 'Chantiers Trabelsi');
        $leila = $this->buyer('leila@marketplace.test', 'Leila', 'Mansour', 'Cabinet Mansour');
        $youssef = $this->buyer('youssef@marketplace.test', 'Youssef', 'Gharbi', 'Startup GreenBox');
        $s = $this->suppliers;

        // Historique pour le « prix habituel du marché » (SCRUM-82) : devis acceptés dans la même catégorie.
        foreach ([[$leila, 3200, 'Carton'], [$youssef, 4100, 'Cartons'], [$leila, 3600, 'Caisses']] as $i => [$buyer, $amount, $word]) {
            $tender = $this->tender($buyer, "{$word} pour conditionnement n° ".($i + 1), 'Achat ponctuel de cartons pour le conditionnement de nos produits alimentaires.', 'Conditionnement alimentaire', 'Sfax', $amount + 500, 80 - $i * 15);
            $quote = $this->quote($s['Atlas Emballages'], $tender, $amount, 7, 'Paiement à 30 jours');
            $order = $this->accept($buyer, $quote, 75 - $i * 15);
            $this->advance($order, [OrderStatus::SHIPPED, OrderStatus::DELIVERED], 70 - $i * 15);
            $this->close($order, 65 - $i * 15);
        }

        // 1. Demande ouverte avec 3 devis à comparer (Sana) : résumé IA et prix du marché.
        $t1 = $this->tender($sana, self::SCENARIO_MARKER,
            'Nous cherchons 5 000 cartons ondulés double cannelure, impression une couleur, pour expédier nos bouteilles d’huile d’olive vers l’Europe. Livraison à Sfax.',
            'Conditionnement alimentaire', 'Sfax', 4500, 6);
        $this->quote($s['Atlas Emballages'], $t1, 3900, 10, 'Paiement à 30 jours, livraison incluse', 'Prix dégressif à partir de 10 000 pièces.');
        $this->quote($s['Djerba Pack'], $t1, 3450, 15, null, 'Cartons fabriqués à Djerba.');
        $this->quote($s['PalettesPlus'], $t1, 4300, 7, 'Paiement à la livraison');

        // 2. Demande acceptée → commande livrée puis clôturée, avis (Sana ↔ PalettesPlus).
        $t2 = $this->tender($sana, 'Palettes EPAL pour notre nouvel entrepôt', 'Besoin de 300 palettes EPAL 1200 x 800 neuves, traitées NIMP 15, livraison à Sfax.', 'Manutention et levage', 'Sfax', 6000, 40);
        $this->quote($s['Djerba Pack'], $t2, 5400, 12);
        $q2 = $this->quote($s['PalettesPlus'], $t2, 5100, 8, 'Paiement à 30 jours');
        $this->quote($s['Atlas Emballages'], $t2, 5900, 10);
        $o2 = $this->accept($sana, $q2, 35);
        $this->advance($o2, [OrderStatus::SHIPPED, OrderStatus::DELIVERED], 30);
        $this->close($o2, 27);
        $this->review($o2, 5, 'Palettes conformes, livraison rapide et équipe très professionnelle. Je recommande.', 'Merci Sana, à bientôt pour le prochain chantier !');

        // 3. Commande en cours de livraison (Sana ↔ TechNova).
        $t3 = $this->tender($sana, 'Maintenance informatique de 30 postes', 'Contrat annuel de maintenance préventive et curative pour 30 postes et le réseau de nos bureaux de Sfax.', 'Réseaux et sécurité', 'Sfax', 12000, 20);
        $q3 = $this->quote($s['TechNova Services'], $t3, 9600, 5, 'Contrat de 12 mois, intervention sous 4 h');
        $this->quote($s['InfoStore Tunis'], $t3, 11200, 7);
        $o3 = $this->accept($sana, $q3, 15);
        $this->advance($o3, [OrderStatus::SHIPPED], 8);

        // 4. Demande ouverte avec un seul devis (Sana ↔ BureauPlus), et une sans devis (Leila).
        $t4 = $this->tender($sana, 'Fournitures de bureau pour l’année', 'Ramettes A4, toners et classeurs pour 25 personnes, livraisons trimestrielles.', 'Papeterie', 'Sfax', 5000, 3);
        $this->quote($s['BureauPlus'], $t4, 4200, 3, 'Livraison trimestrielle gratuite');
        $this->tender($leila, 'Audit comptable de l’exercice 2026', 'Audit légal des comptes d’une PME de 40 salariés, rapport avant fin mars.', 'Comptabilité et audit', 'Tunis', 8000, 1);

        // 5. Commande livrée contestée (Karim ↔ TextilPro) : litige ouvert.
        $t5 = $this->tender($karim, 'Gilets haute visibilité pour chantier', '200 gilets jaunes classe 2 avec logo imprimé dans le dos.', 'Vêtements de travail et EPI', 'Monastir', 3000, 25);
        $q5 = $this->quote($s['TextilPro Monastir'], $t5, 2600, 10);
        $o5 = $this->accept($karim, $q5, 22);
        $this->advance($o5, [OrderStatus::SHIPPED, OrderStatus::DELIVERED], 12);
        app(DisputeService::class)->open($karim->user, $o5, [
            'reason' => DisputeReason::NOT_CONFORM->value,
            'description' => 'Le logo imprimé n’est pas à la bonne couleur sur 60 gilets sur 200. Photos disponibles sur demande.',
        ], []);

        // 6. Demande annulée (Karim).
        $t6 = $this->tender($karim, 'Ciment pour chantier à Gabès', '40 tonnes de ciment CPJ 45 livrées sur chantier.', 'Ciment et béton', 'Sfax', 9000, 18);
        $this->quote($s['BatiSud Matériaux'], $t6, 7400, 3);
        app(TenderService::class)->cancel($t6, $karim->user);

        // 7. Commandes directes du catalogue à différentes étapes.
        $huile = $this->product('Huile d\'olive en vrac');
        $o7 = $this->catalogueOrder($sana, $huile, 200, OrderStatus::DELIVERED, 20);
        $this->close($o7, 16);
        $this->review($o7, 4, 'Huile d’excellente qualité, mais délai un peu long.', null);

        $this->catalogueOrder($karim, $this->product('Câbles électriques 2,5 mm²'), 30, OrderStatus::SHIPPED, 6);
        $this->catalogueOrder($youssef, $this->product('Ramette papier A4 80 g'), 50, OrderStatus::VALIDATED, 1);

        $o8 = $this->catalogueOrder($youssef, $this->product('Ordinateur portable professionnel 15"'), 4, OrderStatus::DELIVERED, 30);
        $dispute = app(DisputeService::class)->open($youssef->user, $o8, [
            'reason' => DisputeReason::DAMAGED->value,
            'description' => 'Un des quatre ordinateurs est arrivé avec l’écran fissuré.',
        ], []);
        app(DisputeService::class)->take($dispute, $this->admin);
        app(DisputeService::class)->decide($dispute, $this->admin, DisputeDecision::REPLACEMENT, 'Photos à l’appui : le fournisseur remplace l’ordinateur endommagé sous 7 jours.');

        $o9 = $this->catalogueOrder($youssef, $this->product('Ciment CPJ 45 (sac de 50 kg)'), 100, OrderStatus::DELIVERED, 14);
        $this->close($o9, 10);
        $bad = $this->review($o9, 1, 'Nul, à éviter !!! Contactez plutôt mon cousin au 98765432.', null);
        ReviewReport::query()->create([
            'review_id' => $bad->id, 'author_id' => $s['BatiSud Matériaux']->user_id, 'reason' => 'faux_avis',
            'details' => 'Ce client n’a jamais signalé de problème et l’avis fait de la publicité pour un concurrent.',
            'status' => ReviewReport::STATUS_PENDING,
        ]);
        $bad->update(['status' => ReviewStatus::REPORTED]);

        $o10 = $this->catalogueOrder($leila, $this->product('Fauteuil de bureau ergonomique'), 6, OrderStatus::DELIVERED, 25);
        $this->close($o10, 21);
        $this->review($o10, 5, 'Fauteuils confortables et livraison rapide, très bon rapport qualité-prix.', 'Merci pour votre confiance !');

        // 8. Messagerie : échanges autour d'une demande et d'une commande.
        $this->conversation($sana->user, $s['Atlas Emballages'], ConversationContext::TENDER, $t1->id, [
            [$sana->user, 'Bonjour, pouvez-vous imprimer notre logo en deux couleurs au lieu d’une ?'],
            [$s['Atlas Emballages']->user, 'Bonjour Madame Ben Salah, oui : comptez 0,15 TND de plus par carton. Je peux mettre à jour le devis.'],
            [$sana->user, 'Parfait, merci. Quel délai pour un premier lot de 1 000 cartons ?'],
            [$s['Atlas Emballages']->user, 'Une semaine après validation du bon à tirer.'],
        ]);
        $this->conversation($karim->user, $s['TextilPro Monastir'], ConversationContext::ORDER, $o5->id, [
            [$karim->user, 'Bonjour, 60 gilets ont un logo de la mauvaise couleur. Que proposez-vous ?'],
            [$s['TextilPro Monastir']->user, 'Toutes nos excuses, nous pouvons réimprimer ces 60 gilets cette semaine.'],
        ]);

        // 9. Alerte d'anomalie : pic de commandes d'un nouveau compte (SCRUM-86).
        $nabil = $this->buyer('nabil@marketplace.test', 'Nabil', 'Test', 'Compte récent');
        foreach (range(1, 6) as $i) {
            $this->catalogueOrder($nabil, $this->product('Gilets haute visibilité'), 5, OrderStatus::VALIDATED, 0);
        }
        app(AnomalyDetector::class)->run();

        // 10. Résumés « Ce que les clients en disent » à jour pour tous les fournisseurs.
        foreach ($this->suppliers as $supplier) {
            AnalyzeReviewJob::dispatchSync($supplier->id);
        }

        $this->command?->info('Démonstration TijaraLink prête : comptes *@marketplace.test, mot de passe « password ».');
    }

    private function buyer(string $email, string $first, string $last, string $organization): BuyerProfile
    {
        $user = User::query()->firstOrCreate(['email' => $email], [
            'name' => "{$first} {$last}", 'first_name' => $first, 'last_name' => $last, 'password' => $this->password,
            'role' => 'buyer', 'status' => UserStatus::ACTIVE->value, 'email_verified_at' => now(),
            'phone' => '+216 98 '.random_int(100, 999).' '.random_int(100, 999),
        ]);

        $profile = $user->buyerProfile()->firstOrCreate([], ['organization' => $organization]);
        $profile->update(['organization' => $organization]);

        return $profile->load('user');
    }

    private function tender(BuyerProfile $buyer, string $title, string $description, string $category, string $region, float $budget, int $daysAgo): Tender
    {
        $tender = app(TenderService::class)->publish($buyer->user, [
            'title' => $title,
            'description' => $description,
            'category_id' => $this->categoryIds([$category])[0],
            'region_id' => Region::query()->firstOrCreate(['name' => $region])->id,
            'budget' => $budget,
            'desired_deadline' => now()->addDays(30)->toDateString(),
        ]);

        $this->backdate($tender, $daysAgo);
        $tender->recipients()->update(['notified_at' => $this->at($daysAgo), 'created_at' => $this->at($daysAgo)]);

        return $tender;
    }

    private function quote(SupplierProfile $supplier, Tender $tender, float $amount, int $days, ?string $conditions = null, ?string $comment = null): Quote
    {
        // Un fournisseur sollicité hors diffusion automatique est invité, comme le ferait le porteur.
        if (! $tender->recipients()->where('supplier_id', $supplier->id)->exists()) {
            app(TenderService::class)->invite($tender, $supplier, $tender->buyer->user);
        }

        return app(QuoteService::class)->submit($supplier->user, $tender, [
            'amount' => $amount, 'delivery_days' => $days, 'conditions' => $conditions, 'comment' => $comment,
        ]);
    }

    private function accept(BuyerProfile $buyer, Quote $quote, int $daysAgo): Order
    {
        $order = app(QuoteService::class)->accept($buyer->user, $quote);
        app(OrderDocumentService::class)->generateQuotePdf($order);
        $this->backdate($order, $daysAgo);
        $order->statusHistory()->update(['changed_at' => $this->at($daysAgo)]);

        return $order->refresh();
    }

    /**
     * @param  list<OrderStatus>  $steps
     */
    private function advance(Order $order, array $steps, int $daysAgo): void
    {
        $supplierUser = $order->supplier->user;

        foreach ($steps as $i => $status) {
            $when = $this->at(max(0, $daysAgo - $i * 2));
            $order->update(['status' => $status]);
            OrderStatusHistory::query()->create(['order_id' => $order->id, 'status' => $status, 'changed_by' => $supplierUser->id, 'changed_at' => $when]);
        }
    }

    private function close(Order $order, int $daysAgo): void
    {
        $order->update(['status' => OrderStatus::CLOSED]);
        OrderStatusHistory::query()->create([
            'order_id' => $order->id, 'status' => OrderStatus::CLOSED, 'changed_by' => $order->buyer->user_id, 'changed_at' => $this->at($daysAgo),
        ]);
        app(OrderDocumentService::class)->generateInvoicePdf($order->refresh());
    }

    private function review(Order $order, int $rating, string $comment, ?string $reply): Review
    {
        $review = Review::query()->create([
            'order_id' => $order->id, 'buyer_id' => $order->buyer_id, 'supplier_id' => $order->supplier_id,
            'rating' => $rating, 'comment' => $comment, 'supplier_reply' => $reply, 'status' => ReviewStatus::PUBLISHED,
        ]);
        app(SupplierRatingService::class)->recompute($order->supplier_id);
        // Sentiment et indice de suspicion (SCRUM-83, SCRUM-84).
        AnalyzeReviewJob::dispatchSync($order->supplier_id, $review->id);

        return $review->refresh();
    }

    private function catalogueOrder(BuyerProfile $buyer, Product $product, int $quantity, OrderStatus $status, int $daysAgo): Order
    {
        $order = Order::query()->create([
            'buyer_id' => $buyer->id, 'supplier_id' => $product->supplier_id, 'origin' => 'catalogue',
            'total' => round($product->price * $quantity, 2), 'status' => OrderStatus::VALIDATED,
        ]);
        $order->items()->create(['product_id' => $product->id, 'label' => $product->title, 'quantity' => $quantity, 'unit_price' => $product->price]);
        OrderStatusHistory::query()->create(['order_id' => $order->id, 'status' => OrderStatus::VALIDATED, 'changed_by' => $buyer->user_id, 'changed_at' => $this->at($daysAgo)]);
        $this->backdate($order, $daysAgo);

        $steps = match ($status) {
            OrderStatus::SHIPPED => [OrderStatus::SHIPPED],
            OrderStatus::DELIVERED => [OrderStatus::SHIPPED, OrderStatus::DELIVERED],
            default => [],
        };
        $this->advance($order, $steps, max(0, $daysAgo - 2));

        return $order->refresh();
    }

    /**
     * @param  list<array{0: User, 1: string}>  $messages
     */
    private function conversation(User $buyer, SupplierProfile $supplier, ConversationContext $context, int $contextId, array $messages): void
    {
        $service = app(ConversationService::class);
        $conversation = $service->open($buyer, $context, $contextId, $supplier->id);

        foreach ($messages as [$sender, $body]) {
            $service->send($conversation, $sender, $body, null);
        }
    }

    private function product(string $title): Product
    {
        return Product::query()->where('title', $title)->firstOrFail();
    }

    /**
     * @param  list<string>  $names
     * @return list<int>
     */
    private function categoryIds(array $names): array
    {
        return array_map(fn (string $name) => Category::query()->where('name', $name)->value('id')
            ?? Category::query()->create(['name' => $name, 'position' => 99])->id, $names);
    }

    /** Une heure de bureau il y a N jours ; aujourd'hui : quelques minutes plus tôt (jamais dans le futur). */
    private function at(int $daysAgo): Carbon
    {
        return $daysAgo === 0
            ? now()->subMinutes(random_int(2, 40))
            : now()->subDays($daysAgo)->setTime(random_int(8, 17), random_int(0, 59));
    }

    private function backdate(Tender|Order $model, int $daysAgo): void
    {
        $model->forceFill(['created_at' => $this->at($daysAgo), 'updated_at' => $this->at(max(0, $daysAgo - 1))])->saveQuietly();
    }
}
