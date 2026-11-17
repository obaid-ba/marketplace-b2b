<?php

namespace App\Services;

use App\Contracts\MediaStorage;
use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\SupplierProfile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Produits d'un fournisseur (SCRUM-33) : enregistrement, publication, photos.
 *
 * Règles de publication : une description et au moins une photo.
 * Un produit retiré par l'administrateur reste retiré (il ne peut pas être republié).
 */
class ProductService
{
    public const MAX_IMAGES = 4;

    public const MAX_IMAGE_KB = 3072;

    public function __construct(private readonly MediaStorage $media) {}

    /**
     * @param  array<string, mixed>  $data  données validées par SaveProductRequest
     */
    public function create(SupplierProfile $supplier, array $data): Product
    {
        $product = new Product(['supplier_id' => $supplier->id, 'status' => ProductStatus::DRAFT]);

        return $this->save($product, $data);
    }

    /**
     * @param  array<string, mixed>  $data  données validées par SaveProductRequest
     */
    public function update(Product $product, array $data): Product
    {
        return $this->save($product, $data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function save(Product $product, array $data): Product
    {
        $status = $this->resolveStatus($product, $data['status']);

        $product->fill([
            'type' => Product::typeFromApi($data['type']),
            'title' => $data['title'],
            'category_id' => $data['category_id'],
            'description' => $data['description'] ?? null,
            'price' => $data['price'],
            'unit' => $data['unit'],
            'stock' => $data['type'] === 'service' ? null : $data['stock'],
            'availability_days' => $data['availability_days'],
        ]);
        $product->status = $status;

        if ($status === ProductStatus::PUBLISHED) {
            $this->ensurePublishable($product);
        }

        $product->save();

        return $product;
    }

    /**
     * Dépublier = repasser en brouillon (SCRUM-34).
     */
    public function unpublish(Product $product): Product
    {
        if ($product->isWithdrawn()) {
            throw ValidationException::withMessages([
                'status' => 'Ce produit a été retiré par l\'administrateur.',
            ]);
        }

        $product->update(['status' => ProductStatus::DRAFT]);

        return $product;
    }

    /**
     * Supprime un produit (SCRUM-34). Déjà commandé : suppression douce (retiré du catalogue et de
     * « Mes produits », mais conservé pour l'historique des commandes). Sinon : suppression définitive
     * avec ses photos.
     *
     * @return bool true si le produit a été supprimé définitivement
     */
    public function delete(Product $product): bool
    {
        if ($product->hasBeenOrdered()) {
            $product->update(['status' => ProductStatus::DRAFT]);
            $product->delete();

            return false;
        }

        $paths = $product->images()->pluck('path')->all();
        $product->forceDelete();

        foreach ($paths as $path) {
            $this->media->delete($path);
        }

        return true;
    }

    /**
     * @param  list<UploadedFile>  $files
     */
    public function addImages(Product $product, array $files): Product
    {
        $existing = $product->images()->count();

        if ($existing + count($files) > self::MAX_IMAGES) {
            throw ValidationException::withMessages([
                'images' => 'Un produit compte au plus '.self::MAX_IMAGES.' photos (il en a déjà '.$existing.').',
            ]);
        }

        $stored = [];
        try {
            DB::transaction(function () use ($product, $files, $existing, &$stored) {
                foreach (array_values($files) as $index => $file) {
                    $path = $this->media->store($file, "products/{$product->id}");
                    $stored[] = $path;
                    $product->images()->create(['path' => $path, 'position' => $existing + $index + 1]);
                }
            });
        } catch (\Throwable $e) {
            foreach ($stored as $path) {
                $this->media->delete($path);
            }

            throw $e;
        }

        return $product->load('images');
    }

    /**
     * @param  list<int>  $imageIds  toutes les photos du produit, dans le nouvel ordre
     */
    public function reorderImages(Product $product, array $imageIds): Product
    {
        $current = $product->images()->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        $requested = collect($imageIds)->map(fn ($id) => (int) $id)->sort()->values()->all();

        if ($current !== $requested) {
            throw ValidationException::withMessages([
                'image_ids' => 'La liste doit contenir exactement les photos du produit.',
            ]);
        }

        DB::transaction(function () use ($product, $imageIds) {
            foreach (array_values($imageIds) as $index => $id) {
                $product->images()->whereKey($id)->update(['position' => $index + 1]);
            }
        });

        return $product->load('images');
    }

    public function deleteImage(Product $product, ProductImage $image): Product
    {
        if ($product->status === ProductStatus::PUBLISHED && $product->images()->count() <= 1) {
            throw ValidationException::withMessages([
                'images' => 'Un produit publié doit garder au moins une photo. Ajoutez-en une autre avant de supprimer celle-ci.',
            ]);
        }

        DB::transaction(function () use ($product, $image) {
            $image->delete();
            $product->images()->get()->values()->each(
                fn (ProductImage $img, int $index) => $img->position !== $index + 1 ? $img->update(['position' => $index + 1]) : null,
            );
        });

        $this->media->delete($image->path);

        return $product->load('images');
    }

    private function resolveStatus(Product $product, string $apiStatus): ProductStatus
    {
        $requested = Product::statusFromApi($apiStatus);

        if ($product->exists && $product->isWithdrawn()) {
            if ($requested !== ProductStatus::WITHDRAWN) {
                throw ValidationException::withMessages([
                    'status' => 'Ce produit a été retiré par l\'administrateur : il ne peut pas être republié.',
                ]);
            }

            return ProductStatus::WITHDRAWN;
        }

        if ($requested === ProductStatus::WITHDRAWN) {
            throw ValidationException::withMessages([
                'status' => 'Seul l\'administrateur peut retirer un produit. Enregistrez-le en brouillon pour le masquer.',
            ]);
        }

        return $requested;
    }

    private function ensurePublishable(Product $product): void
    {
        $errors = [];

        if (blank($product->description)) {
            $errors['description'] = 'Ajoutez une description avant de publier.';
        }

        if (! $product->exists || ! $product->images()->exists()) {
            $errors['images'] = 'Ajoutez au moins une photo avant de publier.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
