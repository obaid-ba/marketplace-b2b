<?php

namespace Tests\Feature\Supplier;

use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Ajouter ou modifier un produit ou un service (SCRUM-33).
 */
class SupplierProductTest extends TestCase
{
    use RefreshDatabase;

    private SupplierProfile $supplier;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake(ProductImage::DISK);
        $this->category = Category::factory()->create();
        $this->supplier = SupplierProfile::factory()->visible()->create(['company_name' => 'Atlas Emballages']);
    }

    private function actingAsSupplier(?SupplierProfile $supplier = null): void
    {
        Sanctum::actingAs(($supplier ?? $this->supplier)->user);
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return [
            'type' => 'product',
            'title' => 'Cartons ondulés sur mesure',
            'category_id' => $this->category->id,
            'description' => 'Cartons simple ou double cannelure.',
            'price' => 2.4,
            'unit' => 'pièce',
            'stock' => 12500,
            'availability_days' => 5,
            'status' => 'draft',
            ...$overrides,
        ];
    }

    private function productOf(SupplierProfile $supplier, array $attributes = []): Product
    {
        return Product::factory()->for($supplier, 'supplier')->create(['category_id' => $this->category->id, ...$attributes]);
    }

    private function image(string $name = 'photo.jpg'): UploadedFile
    {
        return UploadedFile::fake()->image($name, 800, 600);
    }

    // --- Accès ---

    public function test_un_invite_recoit_401(): void
    {
        $this->postJson('/api/supplier/products', $this->payload())->assertUnauthorized();
    }

    public function test_un_porteur_de_projet_ou_un_admin_recoit_403(): void
    {
        foreach ([User::factory()->buyer()->create(), User::factory()->admin()->create()] as $user) {
            Sanctum::actingAs($user);
            $this->postJson('/api/supplier/products', $this->payload())->assertForbidden();
        }
        $this->assertSame(0, Product::count());
    }

    public function test_un_fournisseur_non_valide_recoit_403(): void
    {
        $this->actingAsSupplier(SupplierProfile::factory()->pending()->create());

        $this->postJson('/api/supplier/products', $this->payload())
            ->assertForbidden()
            ->assertJsonPath('reason', 'supplier_not_validated');
    }

    public function test_seul_le_proprietaire_consulte_et_modifie_son_produit(): void
    {
        $other = SupplierProfile::factory()->visible()->create();
        $product = $this->productOf($other);
        $this->actingAsSupplier();

        $this->getJson("/api/supplier/products/{$product->id}")->assertForbidden();
        $this->putJson("/api/supplier/products/{$product->id}", $this->payload())->assertForbidden();
        $this->postJson("/api/supplier/products/{$product->id}/images", ['images' => [$this->image()]])->assertForbidden();
        $this->assertSame(0, $product->images()->count());
    }

    // --- Création et modification ---

    public function test_creation_d_un_brouillon_sans_image(): void
    {
        $this->actingAsSupplier();

        $response = $this->postJson('/api/supplier/products', $this->payload())
            ->assertCreated()
            ->assertJsonPath('product.status', 'draft')
            ->assertJsonPath('product.type', 'product')
            ->assertJsonPath('product.title', 'Cartons ondulés sur mesure')
            ->assertJsonPath('product.price', 2.4)
            ->assertJsonPath('product.images', []);

        $this->assertDatabaseHas('products', [
            'id' => $response->json('product.id'),
            'supplier_id' => $this->supplier->id,
            'status' => ProductStatus::DRAFT->value,
            'type' => 'produit',
        ]);
    }

    public function test_creation_d_un_service_sans_stock(): void
    {
        $this->actingAsSupplier();

        $this->postJson('/api/supplier/products', $this->payload(['type' => 'service', 'stock' => 99, 'unit' => 'jour']))
            ->assertCreated()
            ->assertJsonPath('product.type', 'service')
            ->assertJsonPath('product.stock', null);
    }

    public function test_validation_des_champs(): void
    {
        $this->actingAsSupplier();

        $this->postJson('/api/supplier/products', [
            'type' => 'machine',
            'title' => str_repeat('a', 151),
            'category_id' => 999,
            'price' => -1,
            'unit' => '',
            'stock' => -5,
            'availability_days' => 0,
            'status' => 'draft',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type', 'title', 'category_id', 'price', 'unit', 'stock', 'availability_days']);

        $this->postJson('/api/supplier/products', $this->payload(['stock' => null]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['stock' => 'Le stock est obligatoire pour un produit.']);
    }

    public function test_publication_refusee_sans_image_ni_description(): void
    {
        $this->actingAsSupplier();

        $this->postJson('/api/supplier/products', $this->payload(['status' => 'published', 'description' => '']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'images' => 'Ajoutez au moins une photo avant de publier.',
                'description' => 'Ajoutez une description avant de publier.',
            ]);

        $this->assertSame(0, Product::count());
    }

    public function test_publication_apres_ajout_d_une_photo(): void
    {
        $this->actingAsSupplier();
        $id = $this->postJson('/api/supplier/products', $this->payload())->json('product.id');

        $this->postJson("/api/supplier/products/{$id}/images", ['images' => [$this->image()]])->assertCreated();
        $this->putJson("/api/supplier/products/{$id}", $this->payload(['status' => 'published']))
            ->assertOk()
            ->assertJsonPath('product.status', 'published')
            ->assertJsonPath('message', 'Produit publié : il est visible dans le catalogue.');

        // Visible dans le catalogue public.
        $this->getJson('/api/products')->assertJsonPath('data.0.id', $id);
    }

    public function test_modification_d_un_produit(): void
    {
        $product = $this->productOf($this->supplier);
        $this->actingAsSupplier();

        $this->getJson("/api/supplier/products/{$product->id}")->assertOk()->assertJsonPath('id', $product->id);

        $this->putJson("/api/supplier/products/{$product->id}", $this->payload(['title' => 'Nouveau titre', 'price' => 3]))
            ->assertOk()
            ->assertJsonPath('product.title', 'Nouveau titre')
            ->assertJsonPath('product.price', 3);
    }

    public function test_un_produit_retire_par_l_admin_ne_peut_pas_etre_republie(): void
    {
        $product = $this->productOf($this->supplier, ['status' => ProductStatus::WITHDRAWN, 'withdrawal_reason' => 'Photos trompeuses']);
        ProductImage::create(['product_id' => $product->id, 'path' => 'p.jpg', 'position' => 1]);
        $this->actingAsSupplier();

        $this->getJson("/api/supplier/products/{$product->id}")
            ->assertJsonPath('status', 'withdrawn')
            ->assertJsonPath('withdrawal_reason', 'Photos trompeuses');

        foreach (['published', 'draft'] as $status) {
            $this->putJson("/api/supplier/products/{$product->id}", $this->payload(['status' => $status]))
                ->assertUnprocessable()
                ->assertJsonValidationErrors('status');
        }
        $this->assertSame(ProductStatus::WITHDRAWN, $product->fresh()->status);

        // Les informations restent modifiables, le produit reste retiré.
        $this->putJson("/api/supplier/products/{$product->id}", $this->payload(['status' => 'withdrawn', 'title' => 'Corrigé']))
            ->assertOk()
            ->assertJsonPath('product.status', 'withdrawn');
    }

    public function test_un_fournisseur_ne_peut_pas_retirer_lui_meme_un_produit(): void
    {
        $this->actingAsSupplier();

        $this->postJson('/api/supplier/products', $this->payload(['status' => 'withdrawn']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    // --- Photos ---

    public function test_ajout_de_photos_dans_l_ordre_et_limite_de_quatre(): void
    {
        $product = $this->productOf($this->supplier);
        $this->actingAsSupplier();

        $response = $this->postJson("/api/supplier/products/{$product->id}/images", [
            'images' => [$this->image('a.jpg'), $this->image('b.png'), $this->image('c.webp')],
        ])->assertCreated();

        $this->assertSame([1, 2, 3], collect($response->json('product.images'))->pluck('position')->all());
        foreach ($product->images as $image) {
            Storage::disk(ProductImage::DISK)->assertExists($image->path);
        }

        $this->postJson("/api/supplier/products/{$product->id}/images", ['images' => [$this->image(), $this->image()]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('images');
        $this->assertSame(3, $product->images()->count());
    }

    public function test_formats_et_poids_des_images(): void
    {
        $product = $this->productOf($this->supplier);
        $this->actingAsSupplier();

        $this->postJson("/api/supplier/products/{$product->id}/images", [
            'images' => [UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf')],
        ])->assertUnprocessable()->assertJsonValidationErrors('images.0');

        $this->postJson("/api/supplier/products/{$product->id}/images", [
            'images' => [UploadedFile::fake()->image('lourde.jpg')->size(3073)],
        ])->assertUnprocessable()->assertJsonValidationErrors(['images.0' => 'Chaque image doit peser au plus 3 Mo.']);

        $this->postJson("/api/supplier/products/{$product->id}/images", [
            'images' => [UploadedFile::fake()->image('animation.gif')],
        ])->assertUnprocessable()->assertJsonValidationErrors('images.0');
    }

    public function test_reordonner_les_photos_change_l_image_principale(): void
    {
        $product = $this->productOf($this->supplier);
        $a = ProductImage::create(['product_id' => $product->id, 'path' => 'a.jpg', 'position' => 1]);
        $b = ProductImage::create(['product_id' => $product->id, 'path' => 'b.jpg', 'position' => 2]);
        $c = ProductImage::create(['product_id' => $product->id, 'path' => 'c.jpg', 'position' => 3]);
        $this->actingAsSupplier();

        $this->putJson("/api/supplier/products/{$product->id}/images/order", ['image_ids' => [$c->id, $a->id, $b->id]])
            ->assertOk()
            ->assertJsonPath('product.images.0.id', $c->id);

        $this->assertSame($c->id, $product->fresh()->mainImage->id);

        // La liste doit contenir exactement les photos du produit.
        $this->putJson("/api/supplier/products/{$product->id}/images/order", ['image_ids' => [$a->id, $b->id]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('image_ids');
    }

    public function test_suppression_d_une_photo_renumerote(): void
    {
        $product = $this->productOf($this->supplier);
        $this->actingAsSupplier();
        $this->postJson("/api/supplier/products/{$product->id}/images", ['images' => [$this->image(), $this->image()]]);
        [$first, $second] = $product->images()->get()->all();

        $this->deleteJson("/api/supplier/products/{$product->id}/images/{$first->id}")
            ->assertOk()
            ->assertJsonCount(1, 'product.images');

        Storage::disk(ProductImage::DISK)->assertMissing($first->path);
        $this->assertSame(1, $second->fresh()->position);
    }

    public function test_un_produit_publie_garde_au_moins_une_photo(): void
    {
        $product = $this->productOf($this->supplier, ['status' => ProductStatus::PUBLISHED]);
        $image = ProductImage::create(['product_id' => $product->id, 'path' => 'a.jpg', 'position' => 1]);
        $this->actingAsSupplier();

        $this->deleteJson("/api/supplier/products/{$product->id}/images/{$image->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('images');
        $this->assertModelExists($image);
    }

    public function test_photo_d_un_autre_produit_renvoie_404(): void
    {
        $product = $this->productOf($this->supplier);
        $otherImage = ProductImage::create(['product_id' => $this->productOf($this->supplier)->id, 'path' => 'x.jpg', 'position' => 1]);
        $this->actingAsSupplier();

        $this->deleteJson("/api/supplier/products/{$product->id}/images/{$otherImage->id}")->assertNotFound();
        $this->assertModelExists($otherImage);
    }
}
