<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * PostgreSQL conserve la contrainte CHECK créée par l'ancien type enum après le
     * passage de la colonne en string(50) : on la supprime pour autoriser les types
     * ajoutés à l'inscription (attestation fiscale, CIN du gérant, etc.).
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE supplier_documents DROP CONSTRAINT IF EXISTS supplier_documents_type_check');
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(
            "ALTER TABLE supplier_documents ADD CONSTRAINT supplier_documents_type_check CHECK (type::text = ANY (ARRAY['registre de commerce'::character varying::text, 'certification'::character varying::text]))"
        );
    }
};
