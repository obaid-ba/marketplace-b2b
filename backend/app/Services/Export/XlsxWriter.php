<?php

namespace App\Services\Export;

use RuntimeException;
use ZipArchive;

/**
 * Classeur XLSX minimal, sans dépendance (D23) : une feuille par tableau, textes et nombres.
 * Les textes sont des chaînes littérales (inlineStr) : jamais évalués comme des formules.
 */
class XlsxWriter
{
    private const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

    private const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

    private const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    private const PACKAGE = 'http://schemas.openxmlformats.org/package/2006';

    /**
     * @param  array<string, list<list<string|int|float>>>  $tables
     */
    public function build(array $tables): string
    {
        $path = tempnam(sys_get_temp_dir(), 'xlsx');
        $zip = new ZipArchive;

        if ($path === false || $zip->open($path, ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Impossible de créer le classeur.');
        }

        try {
            $sheets = $types = $links = '';
            $number = 0;

            foreach ($tables as $title => $rows) {
                $number++;
                $name = $this->escape(mb_substr(str_replace(['\\', '/', '?', '*', '[', ']', ':'], ' ', $title), 0, 31));
                $sheets .= "<sheet name=\"{$name}\" sheetId=\"{$number}\" r:id=\"rId{$number}\"/>";
                $types .= "<Override PartName=\"/xl/worksheets/sheet{$number}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>";
                $links .= "<Relationship Id=\"rId{$number}\" Type=\"".self::REL."/worksheet\" Target=\"worksheets/sheet{$number}.xml\"/>";
                $zip->addFromString("xl/worksheets/sheet{$number}.xml", $this->sheet($rows));
            }

            $zip->addFromString('[Content_Types].xml', self::XML.'<Types xmlns="'.self::PACKAGE.'/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'.$types.'</Types>');
            $zip->addFromString('_rels/.rels', self::XML.'<Relationships xmlns="'.self::PACKAGE.'/relationships"><Relationship Id="rId1" Type="'.self::REL.'/officeDocument" Target="xl/workbook.xml"/></Relationships>');
            $zip->addFromString('xl/workbook.xml', self::XML.'<workbook xmlns="'.self::MAIN.'" xmlns:r="'.self::REL.'"><sheets>'.$sheets.'</sheets></workbook>');
            $zip->addFromString('xl/_rels/workbook.xml.rels', self::XML.'<Relationships xmlns="'.self::PACKAGE.'/relationships">'.$links.'</Relationships>');

            if (! $zip->close()) {
                throw new RuntimeException('Impossible de créer le classeur.');
            }

            return (string) file_get_contents($path);
        } finally {
            @unlink($path);
        }
    }

    /**
     * @param  list<list<string|int|float>>  $rows
     */
    private function sheet(array $rows): string
    {
        $xml = '';

        foreach (array_values($rows) as $row => $cells) {
            $xml .= '<row r="'.($row + 1).'">';

            foreach (array_values($cells) as $column => $value) {
                $reference = chr(65 + $column).($row + 1);
                $xml .= is_string($value)
                    ? "<c r=\"{$reference}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{$this->escape($value)}</t></is></c>"
                    : "<c r=\"{$reference}\"><v>{$value}</v></c>";
            }

            $xml .= '</row>';
        }

        return self::XML.'<worksheet xmlns="'.self::MAIN.'"><cols><col min="1" max="6" width="24" customWidth="1"/></cols><sheetData>'.$xml.'</sheetData></worksheet>';
    }

    /** Caractères de contrôle interdits en XML retirés, reste échappé. */
    private function escape(string $value): string
    {
        return htmlspecialchars((string) preg_replace('/[^\x{9}\x{A}\x{D}\x{20}-\x{D7FF}\x{E000}-\x{FFFD}\x{10000}-\x{10FFFF}]/u', '', mb_scrub($value)), ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
