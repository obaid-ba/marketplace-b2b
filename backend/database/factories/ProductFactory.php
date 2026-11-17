<?php

namespace Database\Factories;

use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\SupplierProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Produit de test. Par défaut : brouillon d'un fournisseur en attente.
 * Utilisez ->published() et un fournisseur ->visible() pour un produit affiché dans le catalogue.
 *
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'supplier_id' => SupplierProfile::factory(),
            'category_id' => Category::factory(),
            'type' => Product::TYPE_PRODUCT,
            'title' => ucfirst(fake()->words(3, true)),
            'description' => fake()->sentence(15),
            'price' => fake()->randomFloat(2, 1, 5000),
            'unit' => 'pièce',
            'stock' => fake()->numberBetween(0, 10000),
            'availability_days' => fake()->randomElement([2, 7, 30]),
            'status' => ProductStatus::DRAFT,
        ];
    }

    public function published(): static
    {
        return $this->state(fn () => ['status' => ProductStatus::PUBLISHED]);
    }

    public function withdrawn(string $reason = 'Contenu non conforme.'): static
    {
        return $this->state(fn () => [
            'status' => ProductStatus::WITHDRAWN,
            'withdrawal_reason' => $reason,
        ]);
    }

    public function service(): static
    {
        return $this->state(fn () => ['type' => Product::TYPE_SERVICE, 'stock' => null]);
    }
}
