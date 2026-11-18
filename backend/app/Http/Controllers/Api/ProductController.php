<?php

namespace App\Http\Controllers\Api;

use App\Enums\ProductStatus;
use App\Enums\ValidationStatus;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\SupplierProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Consultation publique des fiches produits et catalogue fournisseur (SCRUM-51).
 */
class ProductController extends Controller
{
    /**
     * Fiche produit détaillée avec données du fournisseur et suggestions du même fournisseur.
     */
    public function show(Product $product): JsonResponse
    {
        $product->load([
            'category:id,name',
            'supplier:id,user_id,company_name,logo,delivery_days,payment_terms,validation_status,is_published,rating_cache',
        ]);

        // Produits additionnels du même fournisseur pour commande directe multi-articles sans panier
        $supplierProducts = Product::query()
            ->where('supplier_id', $product->supplier_id)
            ->where('id', '!=', $product->id)
            ->where('status', ProductStatus::PUBLISHED)
            ->select(['id', 'supplier_id', 'title', 'price', 'unit', 'stock'])
            ->limit(10)
            ->get();

        return response()->json([
            'product' => $product,
            'same_supplier_products' => $supplierProducts,
        ]);
    }

    /**
     * Produits publiés d'un fournisseur spécifique.
     */
    public function bySupplier(SupplierProfile $supplier): JsonResponse
    {
        $products = Product::query()
            ->where('supplier_id', $supplier->id)
            ->where('status', ProductStatus::PUBLISHED)
            ->select(['id', 'supplier_id', 'category_id', 'title', 'description', 'price', 'unit', 'stock'])
            ->get();

        return response()->json([
            'supplier' => [
                'id' => $supplier->id,
                'company_name' => $supplier->company_name,
                'logo' => $supplier->logo,
                'delivery_days' => $supplier->delivery_days,
                'payment_terms' => $supplier->payment_terms,
            ],
            'products' => $products,
        ]);
    }
}
