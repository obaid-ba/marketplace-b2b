<?php

namespace Tests\Unit;

use App\Enums\UserRole;
use PHPUnit\Framework\TestCase;

class UserRoleTest extends TestCase
{
    public function test_les_roles_ont_un_libelle_francais(): void
    {
        $this->assertSame('Fournisseur', UserRole::Supplier->label());
        $this->assertSame('Porteur de projet', UserRole::Buyer->label());
        $this->assertSame('Administrateur', UserRole::Admin->label());
    }
}
