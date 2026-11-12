<?php

namespace Database\Factories;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => fake()->numerify('+216 ## ### ###'),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'role' => UserRole::Buyer,
            'status' => UserStatus::ACTIVE,
            'remember_token' => Str::random(10),
        ];
    }

    public function supplier(): static
    {
        return $this->state(fn () => ['role' => UserRole::Supplier]);
    }

    public function buyer(): static
    {
        return $this->state(fn () => ['role' => UserRole::Buyer]);
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => UserRole::Admin]);
    }

    public function suspended(): static
    {
        return $this->state(fn () => ['status' => UserStatus::SUSPENDED]);
    }

    public function unverified(): static
    {
        return $this->state(fn () => [
            'email_verified_at' => null,
            'status' => UserStatus::EMAIL_TO_VERIFY,
        ]);
    }
}
