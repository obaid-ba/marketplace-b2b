<?php

namespace App\Http\Requests\Dashboard;

use App\Models\Export;
use Illuminate\Validation\Rule;

/**
 * Période, format et indicateurs d'un export de statistiques (SCRUM-75).
 */
class ExportRequest extends PeriodRangeRequest
{
    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['indicators.min' => 'Choisissez au moins un indicateur.'];
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'format' => ['nullable', 'string', 'in:csv,xlsx'],
            'indicators' => ['sometimes', 'array', 'min:1'],
            'indicators.*' => ['string', 'distinct', Rule::in(array_keys(Export::INDICATORS))],
        ];
    }
}
