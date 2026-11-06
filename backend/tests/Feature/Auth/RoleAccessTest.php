<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RoleAccessTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, array{string, string, int}>
     */
    public static function accessMatrix(): array
    {
        return [
            'fournisseur → espace fournisseur' => ['supplier', 'supplier', 200],
            'fournisseur → espace porteur' => ['supplier', 'buyer', 403],
            'fournisseur → back-office' => ['supplier', 'admin', 403],
            'porteur → espace porteur' => ['buyer', 'buyer', 200],
            'porteur → espace fournisseur' => ['buyer', 'supplier', 403],
            'porteur → back-office' => ['buyer', 'admin', 403],
            'admin → back-office' => ['admin', 'admin', 200],
            'admin → espace fournisseur' => ['admin', 'supplier', 403],
        ];
    }

    #[DataProvider('accessMatrix')]
    public function test_chaque_role_n_accede_qu_a_son_espace(string $role, string $space, int $expected): void
    {
        $user = User::factory()->{$role}()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/{$space}/ping")
            ->assertStatus($expected);
    }

    public function test_un_visiteur_non_connecte_recoit_401(): void
    {
        $this->getJson('/api/supplier/ping')->assertUnauthorized();
    }
}
