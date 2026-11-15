<?php

namespace Tests\Unit;

use App\Enums\UserStatus;
use PHPUnit\Framework\TestCase;

class UserStatusTest extends TestCase
{
    public function test_les_cas_suivent_la_convention_upper_snake_des_migrations(): void
    {
        $this->assertSame('e-mail à vérifier', UserStatus::EMAIL_TO_VERIFY->value);
        $this->assertSame('actif', UserStatus::ACTIVE->value);
        $this->assertSame('suspendu', UserStatus::SUSPENDED->value);
        $this->assertSame('désactivé', UserStatus::DEACTIVATED->value);
    }

    public function test_values_renvoie_les_valeurs_stockees_en_base(): void
    {
        $this->assertSame([
            'e-mail à vérifier',
            'actif',
            'suspendu',
            'désactivé',
        ], UserStatus::values());
    }
}
