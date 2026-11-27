<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MoveCategoryRequest;
use App\Http\Requests\Admin\StoreCategoryRequest;
use App\Http\Requests\Admin\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Services\CategoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Gestion des catégories et sous-catégories par l'administrateur (SCRUM-32, maquette AD5).
 */
class CategoryController extends Controller
{
    public function __construct(private readonly CategoryService $categories) {}

    /**
     * Arborescence complète avec, pour chaque nœud, le nombre de produits (tous statuts) et de demandes.
     */
    public function index(): AnonymousResourceCollection
    {
        return CategoryResource::collection($this->categories->tree(publicCounts: false));
    }

    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = $this->categories->create($request->validated(), $request->user());

        return response()->json([
            'message' => 'Catégorie créée.',
            'category' => new CategoryResource($category),
        ], 201);
    }

    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $category = $this->categories->update($category, $request->validated(), $request->user());

        return response()->json([
            'message' => 'Catégorie enregistrée.',
            'category' => new CategoryResource($category),
        ]);
    }

    public function move(MoveCategoryRequest $request, Category $category): JsonResponse
    {
        $category = $this->categories->move(
            $category,
            $request->validated('direction'),
            $request->validated('position') !== null ? (int) $request->validated('position') : null,
            $request->user(),
        );

        return response()->json([
            'message' => 'Ordre mis à jour.',
            'category' => new CategoryResource($category),
        ]);
    }

    public function destroy(Request $request, Category $category): JsonResponse
    {
        $name = $category->name;
        $this->categories->delete($category, $request->user());

        return response()->json(['message' => "La catégorie « {$name} » a été supprimée."]);
    }
}
