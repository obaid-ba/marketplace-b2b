<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use App\Services\CategoryService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Modification d'une catégorie : nom, catégorie parente, position (SCRUM-32).
 * Champs facultatifs : seuls ceux envoyés sont modifiés (parent_id: null = catégorie principale).
 */
class UpdateCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:'.Category::MAX_NAME_LENGTH],
            'parent_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id'],
            'position' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            /** @var Category $category */
            $category = $this->route('category');
            $parentId = $this->has('parent_id')
                ? ($this->filled('parent_id') ? (int) $this->input('parent_id') : null)
                : $category->parent_id;
            $name = $this->has('name') ? (string) $this->input('name') : $category->name;

            CategoryRules::check($validator, app(CategoryService::class), $name, $parentId, $category);
        });
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return CategoryRules::messages();
    }
}
