<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Champs d'inscription détaillés dans docs/ENTITIES.md.
 * - User : prénom, nom, téléphone (déjà présent), avatar
 * - BuyerProfile : type de porteur, fonction, CIN, région, ville, adresse, site,
 *   description du projet, matricule fiscal, source de découverte, acceptation des CGU
 * - SupplierProfile : forme juridique, matricule fiscal, RNE, année de création,
 *   effectif, adresse, ville, site, coordonnées professionnelles, contact,
 *   délai de livraison, conditions de paiement
 * - SupplierDocument : types supplémentaires (attestation fiscale, CIN du gérant)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('first_name')->nullable()->after('name');
            $table->string('last_name')->nullable()->after('first_name');
            $table->string('avatar')->nullable()->after('email_verified_at');
        });

        Schema::table('buyer_profiles', function (Blueprint $table) {
            $table->string('buyer_type', 30)->nullable()->after('organization');
            $table->string('job_title')->nullable()->after('buyer_type');
            $table->string('cin', 8)->nullable()->unique()->after('job_title');
            $table->foreignId('region_id')->nullable()->after('cin')->constrained('regions')->nullOnDelete();
            $table->string('city')->nullable()->after('region_id');
            $table->string('address')->nullable()->after('city');
            $table->string('website')->nullable()->after('address');
            $table->text('project_description')->nullable()->after('website');
            $table->string('tax_id')->nullable()->after('project_description');
            $table->string('discovery_source', 30)->nullable()->after('tax_id');
            $table->timestamp('terms_accepted_at')->nullable()->after('discovery_source');
        });

        Schema::table('supplier_profiles', function (Blueprint $table) {
            $table->string('legal_form', 40)->nullable()->after('company_name');
            $table->string('tax_id')->nullable()->unique()->after('legal_form');
            $table->string('rne_number')->nullable()->unique()->after('tax_id');
            $table->unsignedSmallInteger('founded_year')->nullable()->after('rne_number');
            $table->string('employees_count', 20)->nullable()->after('founded_year');
            $table->string('address')->nullable()->after('contact');
            $table->string('city')->nullable()->after('address');
            $table->string('website')->nullable()->after('city');
            $table->string('professional_email')->nullable()->after('website');
            $table->string('professional_phone')->nullable()->after('professional_email');
            $table->string('contact_name')->nullable()->after('professional_phone');
            $table->string('contact_role')->nullable()->after('contact_name');
            $table->string('contact_phone')->nullable()->after('contact_role');
            $table->unsignedSmallInteger('delivery_days')->nullable()->after('contact_phone');
            $table->text('payment_terms')->nullable()->after('delivery_days');
        });

        // Nouveaux types de justificatifs : la colonne devient une chaîne contrôlée
        // par la validation (portable MySQL / SQLite).
        Schema::table('supplier_documents', function (Blueprint $table) {
            $table->string('type', 50)->change();
        });
    }

    public function down(): void
    {
        Schema::table('supplier_documents', function (Blueprint $table) {
            $table->enum('type', ['registre de commerce', 'certification'])->change();
        });

        Schema::table('supplier_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'legal_form',
                'tax_id',
                'rne_number',
                'founded_year',
                'employees_count',
                'address',
                'city',
                'website',
                'professional_email',
                'professional_phone',
                'contact_name',
                'contact_role',
                'contact_phone',
                'delivery_days',
                'payment_terms',
            ]);
        });

        Schema::table('buyer_profiles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('region_id');
            $table->dropColumn([
                'buyer_type',
                'job_title',
                'cin',
                'city',
                'address',
                'website',
                'project_description',
                'tax_id',
                'discovery_source',
                'terms_accepted_at',
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['first_name', 'last_name', 'avatar']);
        });
    }
};
