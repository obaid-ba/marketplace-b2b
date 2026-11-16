/**
 * Période par défaut des tableaux de bord : les 30 derniers jours, bornes incluses.
 * Les dates sont envoyées à l'API au format `YYYY-MM-DD`.
 */
export function defaultPeriod(today = new Date()) {
  const to = startOfDay(today)
  const from = new Date(to)
  from.setDate(from.getDate() - 29)

  return { from: toDateInputValue(from), to: toDateInputValue(to) }
}

/** Date locale au format attendu par `<input type="date">` et par l'API. */
export function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Vérifie la cohérence d'une période ; renvoie un message en français ou null. */
export function periodError(from, to) {
  if (!from || !to) return 'Choisissez une date de début et une date de fin.'
  if (from > to) return 'La date de début doit précéder la date de fin.'
  return null
}

/** Affiche une date `YYYY-MM-DD` au format `JJ/MM/AAAA`. */
export function formatDate(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(value)
}

function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}
