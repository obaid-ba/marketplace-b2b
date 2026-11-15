<?php

namespace App\Enums;

/**
 * Secteurs d'activité proposés dans la liste déroulante « Secteur » du profil fournisseur (SCRUM-28).
 * Liste fixe : ajouter un secteur = ajouter un cas ici.
 */
enum SupplierSector: string
{
    case AGRIFOOD = 'Agroalimentaire';
    case CONSTRUCTION = 'BTP et matériaux de construction';
    case CHEMICALS = 'Chimie et plasturgie';
    case ELECTRICAL = 'Électricité et électronique';
    case PACKAGING = 'Emballage et conditionnement';
    case INDUSTRIAL_EQUIPMENT = 'Équipements industriels';
    case OFFICE_SUPPLIES = 'Fournitures et mobilier de bureau';
    case IT = 'Informatique et télécommunications';
    case LOGISTICS = 'Logistique et transport';
    case METALWORK = 'Mécanique et métallurgie';
    case HEALTH = 'Santé et pharmacie';
    case BUSINESS_SERVICES = 'Services aux entreprises';
    case TEXTILE = 'Textile et habillement';
    case OTHER = 'Autre';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
