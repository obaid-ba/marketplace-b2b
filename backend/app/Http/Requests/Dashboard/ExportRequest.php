<?php

namespace App\Http\Requests\Dashboard;

/**
 * Période et format d'un export de statistiques (SCRUM-75).
 */
class ExportRequest extends PeriodRangeRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'format' => ['nullable', 'string', 'in:csv,xlsx'],
        ];
    }
}
