/**
 * Formatage des montants renvoyés par l'API.
 *
 * L'API envoie des montants décimaux sous forme de chaîne (« 1500.00 ») pour
 * éviter les erreurs d'arrondi. On formate donc la chaîne sans la convertir en
 * nombre flottant : séparateur de milliers espace, virgule décimale, devise TND.
 */
export function formatAmount(value) {
  if (value === null || value === undefined || value === '') return '—'

  const raw = String(value).trim()
  const negative = raw.startsWith('-')
  const [integerPart, decimalPart = ''] = raw.replace('-', '').split('.')

  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  const decimals = decimalPart.padEnd(2, '0').slice(0, 2)

  return `${negative ? '-' : ''}${grouped},${decimals} TND`
}

/** Nombre entier avec séparateur de milliers (français). */
export function formatCount(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('fr-FR').format(Number(value))
}
