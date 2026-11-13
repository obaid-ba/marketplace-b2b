<?php

namespace Database\Seeders;

use App\Enums\SupplierSector;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\ValidationStatus;
use App\Models\Category;
use App\Models\Region;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Deux fournisseurs de démonstration pour tester la page « Profil de l'entreprise » (SCRUM-28)
 * sans passer par l'inscription : un validé et un en attente. Mot de passe : « password ».
 *
 *   php artisan db:seed --class=SupplierProfileDemoSeeder
 *
 * Peut être relancé sans créer de doublons. Indépendant de DatabaseSeeder.
 */
class SupplierProfileDemoSeeder extends Seeder
{
    public function run(): void
    {
        $regions = collect(['Tunis', 'Sfax', 'Sousse', 'Gabès', 'Médenine', 'Sidi Bouzid'])
            ->mapWithKeys(fn (string $name) => [$name => Region::firstOrCreate(['name' => $name])]);

        $categories = collect(['Emballage', 'Logistique', 'Agroalimentaire'])
            ->map(fn (string $name, int $index) => Category::firstOrCreate(
                ['name' => $name, 'parent_id' => null],
                ['position' => 100 + $index],
            ));

        $this->supplier(
            email: 'fournisseur.valide@marketplace.test',
            company: 'Atlas Emballages',
            status: ValidationStatus::VALIDATED,
            region: $regions['Sfax'],
            categories: $categories->pluck('id')->all(),
            coverage: $regions->only(['Sfax', 'Médenine', 'Gabès', 'Sousse', 'Tunis'])->pluck('id')->all(),
        );

        $this->supplier(
            email: 'fournisseur.attente@marketplace.test',
            company: 'Djerba Logistique',
            status: ValidationStatus::PENDING,
            region: $regions['Médenine'],
            categories: [$categories[1]->id],
            coverage: $regions->only(['Médenine', 'Gabès'])->pluck('id')->all(),
        );
    }

    /**
     * @param  list<int>  $categories
     * @param  list<int>  $coverage
     */
    private function supplier(
        string $email,
        string $company,
        ValidationStatus $status,
        Region $region,
        array $categories,
        array $coverage,
    ): void {
        $user = User::firstOrCreate(['email' => $email], [
            'name' => $company,
            'phone' => '+216 74000000',
            'password' => 'password',
            'role' => UserRole::Supplier,
            'status' => UserStatus::ACTIVE,
        ]);
        $user->forceFill(['email_verified_at' => $user->email_verified_at ?? now()])->save();

        $profile = SupplierProfile::firstOrNew(['user_id' => $user->id]);
        $profile->forceFill([
            'company_name' => $company,
            'description' => 'Spécialiste des emballages en carton ondulé depuis 2009. 60 employés, capacité de 2 millions de pièces par mois.',
            'sector' => SupplierSector::PACKAGING->value,
            'region_id' => $region->id,
            'professional_phone' => '+216 74000000',
            'professional_email' => 'contact@'.str($company)->slug().'.tn',
            'validation_status' => $status,
            'validated_at' => $status === ValidationStatus::VALIDATED ? now() : null,
            'is_published' => $status === ValidationStatus::VALIDATED,
            'rating_avg' => $status === ValidationStatus::VALIDATED ? 4.6 : 0,
            'reviews_count' => $status === ValidationStatus::VALIDATED ? 38 : 0,
        ])->save();

        $profile->categories()->sync($categories);
        $profile->coverageRegions()->sync($coverage);
    }
}
