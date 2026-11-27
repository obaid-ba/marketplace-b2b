<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use App\Services\CategoryService;
use Illuminate\Validation\Validator;

/**
 * Règles communes à la création et à la modification d'une catégorie (SCRUM-32).
 */
final class CategoryRules
{
    /**
     * Profondeur maximale de 2 niveaux, pas d'auto-parenté, nom unique sous un même parent.
     */
    public static function check(
        Validator $validator,
        CategoryService $service,
        string $name,
        ?int $parentId,
        ?Category $category = null,
    ): void {
        if ($category !== null && $parentId === $category->id) {
            $validator->errors()->add('parent_id', 'Une catégorie ne peut pas être sa propre catégorie parente.');

            return;
        }

        if ($parentId !== null) {
            $parent = Category::query()->find($parentId);

            if ($parent !== null && ! $parent->isRoot()) {
                $validator->errors()->add(
                    'parent_id',
                    'Choisissez une catégorie principale : l\'arborescence est limitée à deux niveaux.',
                );

                return;
            }

            if ($category !== null && $category->children()->exists()) {
                $validator->errors()->add(
                    'parent_id',
                    'Cette catégorie contient des sous-catégories : elle ne peut pas devenir elle-même une sous-catégorie.',
                );

                return;
            }
        }

        if ($service->nameTaken($name, $parentId, $category?->id)) {
            $validator->errors()->add(
                'name',
                $parentId === null
                    ? 'Une catégorie principale porte déjà ce nom.'
                    : 'Une sous-catégorie de ce parent porte déjà ce nom.',
            );
        }
    }

    /**
     * @return array<string, string>
     */
    public static function messages(): array
    {
        return [
            'name.required' => 'Le nom de la catégorie est obligatoire.',
            'name.max' => 'Le nom ne doit pas dépasser :max caractères.',
            'parent_id.integer' => 'La catégorie parente est invalide.',
            'parent_id.exists' => 'La catégorie parente est introuvable.',
            'position.integer' => 'La position doit être un nombre entier.',
            'position.min' => 'La position commence à 1.',
        ];
    }
}
