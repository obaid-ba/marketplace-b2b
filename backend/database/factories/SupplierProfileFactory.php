<?php

namespace Database\Factories;

use App\Enums\SupplierSector;
use App\Enums\ValidationStatus;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Profil fournisseur de test (SCRUM-28) : permet de tester sans passer par l'inscription (F01).
 *
 * @extends Factory<SupplierProfile>
 */
class SupplierProfileFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->supplier(),
            'company_name' => fake()->company(),
            'description' => fake()->sentence(12),
            'sector' => SupplierSector::PACKAGING->value,
            'professional_phone' => fake()->numerify('+216 ########'),
            'professional_email' => fake()->unique()->companyEmail(),
            'is_published' => false,
            'validation_status' => ValidationStatus::PENDING,
        ];
    }

    public function pending(): static
    {
        return $this->state(fn () => [
            'validation_status' => ValidationStatus::PENDING,
            'is_published' => false,
        ]);
    }

    public function validated(): static
    {
        return $this->state(fn () => [
            'validation_status' => ValidationStatus::VALIDATED,
            'validated_at' => now(),
        ]);
    }

    public function rejected(): static
    {
        return $this->state(fn () => [
            'validation_status' => ValidationStatus::REJECTED,
            'rejection_reason' => 'Registre de commerce illisible.',
            'validated_at' => now(), // date de la décision de l'administrateur (validation ou refus)
            'is_published' => false,
        ]);
    }
}
