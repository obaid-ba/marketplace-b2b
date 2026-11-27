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
 *
 * Les colonnes sont ajoutées uniquement si elles n'existent pas déjà : TiDB
 * (compatible PostgreSQL) n'annule pas les DDL d'une transaction, une migration
 * interrompue peut donc laisser un schéma partiellement migré.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'first_name')) {
                $table->string('first_name')->nullable()->after('name');
            }
            if (! Schema::hasColumn('users', 'last_name')) {
                $table->string('last_name')->nullable()->after('first_name');
            }
            if (! Schema::hasColumn('users', 'avatar')) {
                $table->string('avatar')->nullable()->after('email_verified_at');
            }
        });

        Schema::table('buyer_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('buyer_profiles', 'buyer_type')) {
                $table->string('buyer_type', 30)->nullable()->after('organization');
            }
            if (! Schema::hasColumn('buyer_profiles', 'job_title')) {
                $table->string('job_title')->nullable()->after('buyer_type');
            }
            if (! Schema::hasColumn('buyer_profiles', 'cin')) {
                $table->string('cin', 8)->nullable()->unique()->after('job_title');
            }
            if (! Schema::hasColumn('buyer_profiles', 'region_id')) {
                $table->foreignId('region_id')->nullable()->after('cin')->constrained('regions')->nullOnDelete();
            }
            if (! Schema::hasColumn('buyer_profiles', 'city')) {
                $table->string('city')->nullable()->after('region_id');
            }
            if (! Schema::hasColumn('buyer_profiles', 'address')) {
                $table->string('address')->nullable()->after('city');
            }
            if (! Schema::hasColumn('buyer_profiles', 'website')) {
                $table->string('website')->nullable()->after('address');
            }
            if (! Schema::hasColumn('buyer_profiles', 'project_description')) {
                $table->text('project_description')->nullable()->after('website');
            }
            if (! Schema::hasColumn('buyer_profiles', 'tax_id')) {
                $table->string('tax_id')->nullable()->after('project_description');
            }
            if (! Schema::hasColumn('buyer_profiles', 'discovery_source')) {
                $table->string('discovery_source', 30)->nullable()->after('tax_id');
            }
            if (! Schema::hasColumn('buyer_profiles', 'terms_accepted_at')) {
                $table->timestamp('terms_accepted_at')->nullable()->after('discovery_source');
            }
        });

        Schema::table('supplier_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('supplier_profiles', 'legal_form')) {
                $table->string('legal_form', 40)->nullable()->after('company_name');
            }
            if (! Schema::hasColumn('supplier_profiles', 'tax_id')) {
                $table->string('tax_id')->nullable()->unique()->after('legal_form');
            }
            if (! Schema::hasColumn('supplier_profiles', 'rne_number')) {
                $table->string('rne_number')->nullable()->unique()->after('tax_id');
            }
            if (! Schema::hasColumn('supplier_profiles', 'founded_year')) {
                $table->unsignedSmallInteger('founded_year')->nullable()->after('rne_number');
            }
            if (! Schema::hasColumn('supplier_profiles', 'employees_count')) {
                $table->string('employees_count', 20)->nullable()->after('founded_year');
            }
            if (! Schema::hasColumn('supplier_profiles', 'address')) {
                $table->string('address')->nullable()->after('contact');
            }
            if (! Schema::hasColumn('supplier_profiles', 'city')) {
                $table->string('city')->nullable()->after('address');
            }
            if (! Schema::hasColumn('supplier_profiles', 'website')) {
                $table->string('website')->nullable()->after('city');
            }
            if (! Schema::hasColumn('supplier_profiles', 'professional_email')) {
                $table->string('professional_email')->nullable()->after('website');
            }
            if (! Schema::hasColumn('supplier_profiles', 'professional_phone')) {
                $table->string('professional_phone')->nullable()->after('professional_email');
            }
            if (! Schema::hasColumn('supplier_profiles', 'contact_name')) {
                $table->string('contact_name')->nullable()->after('professional_phone');
            }
            if (! Schema::hasColumn('supplier_profiles', 'contact_role')) {
                $table->string('contact_role')->nullable()->after('contact_name');
            }
            if (! Schema::hasColumn('supplier_profiles', 'contact_phone')) {
                $table->string('contact_phone')->nullable()->after('contact_role');
            }
            if (! Schema::hasColumn('supplier_profiles', 'delivery_days')) {
                $table->unsignedSmallInteger('delivery_days')->nullable()->after('contact_phone');
            }
            if (! Schema::hasColumn('supplier_profiles', 'payment_terms')) {
                $table->text('payment_terms')->nullable()->after('delivery_days');
            }
        });

        // Nouveaux types de justificatifs : la colonne devient une chaîne contrôlée
        // par la validation (portable MySQL / SQLite).
        // Sur PostgreSQL / TiDB compatible PostgreSQL, la colonne est déjà un
        // varchar : on se contente de retirer la contrainte de valeurs, car la
        // grammaire `change()` génère un « drop identity » non supporté par TiDB.
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            try {
                Schema::getConnection()->statement(
                    'alter table "supplier_documents" drop constraint if exists "supplier_documents_type_check"'
                );
            } catch (Throwable $e) {
                // Contrainte déjà absente : rien à faire.
            }
        } else {
            Schema::table('supplier_documents', function (Blueprint $table) {
                $table->string('type', 50)->change();
            });
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            Schema::table('supplier_documents', function (Blueprint $table) {
                $table->enum('type', ['registre de commerce', 'certification'])->change();
            });
        }

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
