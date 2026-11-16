<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Gestion des catégories et sous-catégories (SCRUM-32 / F06).
 */
class CategoryController extends Controller
{
    /**
     * Arborescence complète des catégories et sous-catégories avec comptage d'utilisation.
     */
    public function index(): JsonResponse
    {
        $categories = Category::query()
            ->whereNull('parent_id')
            ->orderBy('position', 'asc')
            ->orderBy('id', 'asc')
            ->with(['children' => fn ($q) => $q->orderBy('position', 'asc')->orderBy('id', 'asc')])
            ->get();

        $productCounts = DB::table('products')
            ->select('category_id', DB::raw('count(*) as count'))
            ->groupBy('category_id')
            ->pluck('count', 'category_id');

        $tenderCounts = DB::table('tenders')
            ->select('category_id', DB::raw('count(*) as count'))
            ->groupBy('category_id')
            ->pluck('count', 'category_id');

        $aiTenderCounts = DB::table('tenders')
            ->whereNotNull('ai_category_id')
            ->select('ai_category_id', DB::raw('count(*) as count'))
            ->groupBy('ai_category_id')
            ->pluck('count', 'ai_category_id');

        foreach ($categories as $category) {
            $catDirectProducts = (int) ($productCounts->get($category->id, 0));
            $catDirectTenders = (int) ($tenderCounts->get($category->id, 0) + $aiTenderCounts->get($category->id, 0));

            $childrenProducts = 0;
            $childrenTenders = 0;

            foreach ($category->children as $child) {
                $childP = (int) ($productCounts->get($child->id, 0));
                $childT = (int) ($tenderCounts->get($child->id, 0) + $aiTenderCounts->get($child->id, 0));

                $child->setAttribute('products_count', $childP);
                $child->setAttribute('tenders_count', $childT);

                $childrenProducts += $childP;
                $childrenTenders += $childT;
            }

            // Pour la catégorie principale, afficher l'ensemble de son arborescence
            $category->setAttribute('products_count', $catDirectProducts + $childrenProducts);
            $category->setAttribute('tenders_count', $catDirectTenders + $childrenTenders);
        }

        return response()->json($categories);
    }

    /**
     * Création d'une catégorie ou sous-catégorie.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'position' => ['nullable', 'integer', 'min:0'],
        ], [
            'name.required' => 'Le nom de la catégorie est obligatoire.',
            'parent_id.exists' => 'La catégorie parente sélectionnée est introuvable.',
        ]);

        $parentId = $validated['parent_id'] ?? null;

        // Limiter l'arborescence à 2 niveaux : une sous-catégorie ne peut pas être parente
        if ($parentId !== null) {
            $parent = Category::find($parentId);
            if ($parent && $parent->parent_id !== null) {
                return response()->json([
                    'message' => 'Une sous-catégorie ne peut pas avoir une autre sous-catégorie comme parente (limité à 2 niveaux).',
                    'errors' => ['parent_id' => ['La catégorie parente doit être une catégorie principale de niveau 1.']],
                ], 422);
            }
        }

        $position = array_key_exists('position', $validated) && $validated['position'] !== null
            ? (int) $validated['position']
            : (int) Category::where('parent_id', $parentId)->max('position') + 1;

        $category = DB::transaction(function () use ($request, $validated, $parentId, $position) {
            $cat = Category::create([
                'name' => trim($validated['name']),
                'parent_id' => $parentId,
                'position' => $position,
            ]);

            AuditLog::create([
                'admin_id' => $request->user()->id,
                'action' => 'category.created',
                'target' => "category:{$cat->id}",
                'reason' => "Création de la catégorie « {$cat->name} »",
            ]);

            return $cat;
        });

        return response()->json([
            'message' => 'Catégorie créée avec succès.',
            'category' => $category,
        ], 201);
    }

    /**
     * Modification d'une catégorie (renommage, parent_id, position).
     */
    public function update(Request $request, Category $category): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'position' => ['sometimes', 'nullable', 'integer', 'min:0'],
        ], [
            'name.required' => 'Le nom de la catégorie ne peut pas être vide.',
            'parent_id.exists' => 'La catégorie parente sélectionnée est introuvable.',
        ]);

        // Vérification de la parenté
        if (array_key_exists('parent_id', $validated)) {
            $newParentId = $validated['parent_id'];

            if ($newParentId !== null && (int) $newParentId === $category->id) {
                return response()->json([
                    'message' => 'Une catégorie ne peut pas être sa propre parente.',
                    'errors' => ['parent_id' => ['Une catégorie ne peut pas être sa propre parente.']],
                ], 422);
            }

            // Si la catégorie a déjà des sous-catégories, elle ne peut pas être rattachée sous une autre
            if ($newParentId !== null && $category->children()->exists()) {
                return response()->json([
                    'message' => 'Une catégorie contenant déjà des sous-catégories ne peut pas devenir elle-même une sous-catégorie.',
                    'errors' => ['parent_id' => ['Impossible de rattacher une catégorie parente sous une autre catégorie.']],
                ], 422);
            }

            // Vérifier que le nouveau parent est bien de niveau 1
            if ($newParentId !== null) {
                $newParent = Category::find($newParentId);
                if ($newParent && $newParent->parent_id !== null) {
                    return response()->json([
                        'message' => 'La catégorie parente doit être une catégorie principale de niveau 1.',
                        'errors' => ['parent_id' => ['Arborescence limitée à 2 niveaux.']],
                    ], 422);
                }
            }
        }

        DB::transaction(function () use ($request, $category, $validated) {
            $dataToUpdate = [];
            if (array_key_exists('name', $validated)) {
                $dataToUpdate['name'] = trim($validated['name']);
            }
            if (array_key_exists('parent_id', $validated)) {
                $dataToUpdate['parent_id'] = $validated['parent_id'];
            }
            if (array_key_exists('position', $validated)) {
                $dataToUpdate['position'] = $validated['position'];
            }

            $category->update($dataToUpdate);

            AuditLog::create([
                'admin_id' => $request->user()->id,
                'action' => 'category.updated',
                'target' => "category:{$category->id}",
                'reason' => "Modification de la catégorie « {$category->name} »",
            ]);
        });

        return response()->json([
            'message' => 'Catégorie modifiée avec succès.',
            'category' => $category->fresh(),
        ]);
    }

    /**
     * Réordonnancement des catégories et sous-catégories.
     */
    public function reorder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'exists:categories,id'],
            'items.*.position' => ['required', 'integer', 'min:0'],
            'items.*.parent_id' => ['nullable', 'integer', 'exists:categories,id'],
        ], [
            'items.required' => 'La liste des éléments à réordonner est requise.',
            'items.*.id.exists' => 'Une des catégories spécifiées est introuvable.',
        ]);

        DB::transaction(function () use ($request, $validated) {
            foreach ($validated['items'] as $item) {
                $updateData = ['position' => $item['position']];
                if (array_key_exists('parent_id', $item)) {
                    $updateData['parent_id'] = $item['parent_id'];
                }
                Category::where('id', $item['id'])->update($updateData);
            }

            AuditLog::create([
                'admin_id' => $request->user()->id,
                'action' => 'category.reordered',
                'target' => 'categories',
                'reason' => 'Réordonnancement des catégories',
            ]);
        });

        return response()->json([
            'message' => 'Ordre des catégories mis à jour avec succès.',
        ]);
    }

    /**
     * Suppression d'une catégorie (avec contrôle strict des produits et demandes liés).
     */
    public function destroy(Request $request, Category $category): JsonResponse
    {
        $childIds = $category->children()->pluck('id')->all();
        $allIds = array_merge([$category->id], $childIds);

        $productsCount = DB::table('products')->whereIn('category_id', $allIds)->count();
        $tendersCount = DB::table('tenders')
            ->where(function ($q) use ($allIds) {
                $q->whereIn('category_id', $allIds)
                    ->orWhereIn('ai_category_id', $allIds);
            })
            ->count();

        if ($productsCount > 0 || $tendersCount > 0) {
            return response()->json([
                'message' => "Suppression impossible : cette catégorie (ou l'une de ses sous-catégories) est utilisée par {$productsCount} produit(s) et {$tendersCount} demande(s).",
                'reason' => 'category_in_use',
                'products_count' => $productsCount,
                'tenders_count' => $tendersCount,
            ], 422);
        }

        $categoryName = $category->name;
        $categoryId = $category->id;

        DB::transaction(function () use ($request, $category, $childIds, $categoryName, $categoryId) {
            if (! empty($childIds)) {
                Category::whereIn('id', $childIds)->delete();
            }
            $category->delete();

            AuditLog::create([
                'admin_id' => $request->user()->id,
                'action' => 'category.deleted',
                'target' => "category:{$categoryId}",
                'reason' => "Suppression de la catégorie « {$categoryName} »",
            ]);
        });

        return response()->json([
            'message' => "La catégorie « {$categoryName} » a été supprimée avec succès.",
        ]);
    }
}
