<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use App\Services\CategoryService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Création d'une catégorie ou d'une sous-catégorie (SCRUM-32).
 */
class StoreCategoryRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:'.Category::MAX_NAME_LENGTH],
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'position' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * Règles de l'arborescence : parent de premier niveau, nom unique parmi les sœurs.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $parentId = $this->integerOrNull('parent_id');
            CategoryRules::check($validator, app(CategoryService::class), (string) $this->input('name'), $parentId);
        });
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return CategoryRules::messages();
    }

    private function integerOrNull(string $key): ?int
    {
        return $this->filled($key) ? (int) $this->input($key) : null;
    }
}
