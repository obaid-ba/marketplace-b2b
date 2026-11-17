<?php

namespace App\Http\Requests\Dashboard;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Période commune aux tableaux de bord (SCRUM-122 / F28, réutilisable F26–F27).
 *
 * - `from` et `to` sont facultatifs : par défaut, les 30 derniers jours.
 * - La période est interprétée en heure tunisienne (Africa/Tunis).
 * - Elle ne peut pas dépasser 366 jours ni être inversée.
 */
class PeriodRangeRequest extends FormRequest
{
    public const DEFAULT_DAYS = 30;

    public const MAX_DAYS = 366;

    public const TIMEZONE = 'Africa/Tunis';

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
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            [$from, $to] = $this->range();

            if ($from->greaterThan($to)) {
                $validator->errors()->add('from', 'La date de début doit précéder la date de fin.');

                return;
            }

            if ($from->diffInDays($to->startOfDay()) + 1 > self::MAX_DAYS) {
                $validator->errors()->add('to', 'La période ne doit pas dépasser 366 jours.');
            }
        });
    }

    /**
     * Bornes inclusives de la période, dans le fuseau tunisien.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public function range(): array
    {
        $to = $this->filled('to')
            ? CarbonImmutable::createFromFormat('Y-m-d', $this->string('to')->toString(), self::TIMEZONE)->endOfDay()
            : CarbonImmutable::now(self::TIMEZONE)->endOfDay();

        $from = $this->filled('from')
            ? CarbonImmutable::createFromFormat('Y-m-d', $this->string('from')->toString(), self::TIMEZONE)->startOfDay()
            : $to->subDays(self::DEFAULT_DAYS - 1)->startOfDay();

        return [$from, $to];
    }
}
