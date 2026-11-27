<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Services\CategoryService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Arborescence publique des catégories (SCRUM-32) : filtres du catalogue, formulaire produit,
 * fil d'Ariane, page d'accueil. products_count ne compte que les produits visibles.
 */
class CategoryController extends Controller
{
    public function index(CategoryService $categories): AnonymousResourceCollection
    {
        return CategoryResource::collection($categories->tree(publicCounts: true));
    }
}
