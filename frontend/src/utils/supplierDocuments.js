/**
 * Justificatifs du fournisseur : partagé par le profil (SCRUM-28) et la page
 * « Compte en attente » (renvoi de documents après un refus, SCRUM-27).
 */

// Mêmes valeurs que SupplierDocument::TYPE_* côté Laravel.
export const DOCUMENT_TYPES = [
  { value: 'registre de commerce', label: 'Registre de commerce' },
  { value: 'attestation fiscale', label: 'Attestation fiscale' },
  { value: 'cin gerant', label: 'CIN du gérant' },
  { value: 'certification', label: 'Certification' },
]

// Mêmes règles que StoreSupplierDocumentRequest : PDF / JPG / PNG, 5 Mo maximum.
export const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png'
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024

/** Contrôle avant envoi ; renvoie le message d'erreur ou null. */
export function documentFileError(file) {
  if (!DOCUMENT_ACCEPT.split(',').includes(file.type)) {
    return 'Le document doit être un PDF ou une image (JPG, PNG).'
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return 'Le document ne doit pas dépasser 5 Mo.'
  }
  return null
}
