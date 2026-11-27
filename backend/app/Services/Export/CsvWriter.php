<?php

namespace App\Services\Export;

/**
 * CSV pour Excel en français : UTF-8 avec BOM, point-virgule, virgule décimale.
 */
class CsvWriter
{
    /**
     * @param  array<string, list<list<string|int|float>>>  $tables
     */
    public function build(array $tables): string
    {
        $handle = fopen('php://temp', 'r+');
        fwrite($handle, "\xEF\xBB\xBF");
        $first = true;

        foreach ($tables as $title => $rows) {
            if (! $first) {
                fwrite($handle, "\n");
            }
            $first = false;

            foreach ([[$title], ...$rows] as $row) {
                fputcsv($handle, array_map($this->cell(...), $row), ';', '"', '');
            }
        }

        rewind($handle);
        $csv = (string) stream_get_contents($handle);
        fclose($handle);

        return $csv;
    }

    private function cell(string|int|float $value): string
    {
        if (is_float($value)) {
            return str_replace('.', ',', (string) $value);
        }

        // Un texte commençant par = + - @ serait exécuté comme une formule par le tableur.
        return is_string($value) && preg_match('/^[=+\-@\t\r]/', $value) ? "'".$value : (string) $value;
    }
}
