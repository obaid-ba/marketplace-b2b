/**
 * Lecture / écriture des filtres du catalogue dans l'URL (SCRUM-35) :
 * /catalogue?q=carton&category=3,5&type=product&region=12&price_min=0&price_max=5000&delay=7&rating=4&sort=price_asc&page=2
 */

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'rating', label: 'Note' },
  { value: 'newest', label: 'Nouveautés' },
]

export const DELAY_OPTIONS = [
  { value: '2', label: 'Sous 48 h' },
  { value: '7', label: 'Sous 7 jours' },
  { value: '30', label: 'Sous 30 jours' },
]

export const RATING_OPTIONS = [
  { value: '4', label: '4 ★ et plus' },
  { value: '3', label: '3 ★ et plus' },
]

export const TYPE_OPTIONS = [
  { value: 'product', label: 'Produit' },
  { value: 'service', label: 'Service' },
]

const LIST_KEYS = ['category', 'type', 'region']

const list = (value) => (value ? value.split(',').filter(Boolean) : [])

/** URLSearchParams → état des filtres. */
export function readFilters(searchParams) {
  const get = (key) => searchParams.get(key) ?? ''
  const q = get('q')
  return {
    q,
    category: list(get('category')),
    type: list(get('type')),
    region: list(get('region')),
    price_min: get('price_min'),
    price_max: get('price_max'),
    delay: get('delay'),
    rating: get('rating'),
    sort: get('sort') || (q ? 'relevance' : 'newest'),
    page: Math.max(1, Number(get('page')) || 1),
  }
}

/** Paramètres envoyés à GET /api/products (valeurs vides retirées). */
export function toApiParams(filters) {
  const params = {}
  for (const [key, value] of Object.entries(filters)) {
    if (LIST_KEYS.includes(key)) {
      if (value.length) params[key] = value.join(',')
    } else if (key === 'page') {
      if (value > 1) params.page = value
    } else if (value !== '' && value !== null && value !== undefined) {
      params[key] = value
    }
  }
  return params
}

/**
 * Nouvelle URL après modification d'un filtre. Tout changement autre que la page renvoie en page 1.
 * changes : { category: ['3'], price_min: '10', … }
 */
export function applyChanges(searchParams, changes) {
  const next = new URLSearchParams(searchParams)
  for (const [key, value] of Object.entries(changes)) {
    const serialized = Array.isArray(value) ? value.join(',') : String(value ?? '')
    if (serialized === '') next.delete(key)
    else next.set(key, serialized)
  }
  if (!('page' in changes)) next.delete('page')
  if (next.get('page') === '1') next.delete('page')
  return next
}

/** Nombre de filtres actifs (bouton « Filtres (n) » sur mobile). */
export function activeFilterCount(filters) {
  return (
    filters.category.length +
    filters.type.length +
    filters.region.length +
    (filters.price_min !== '' ? 1 : 0) +
    (filters.price_max !== '' ? 1 : 0) +
    (filters.delay ? 1 : 0) +
    (filters.rating ? 1 : 0)
  )
}

export const FILTER_KEYS = ['category', 'type', 'region', 'price_min', 'price_max', 'delay', 'rating']
