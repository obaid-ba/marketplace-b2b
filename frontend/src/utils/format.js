/**
 * Formats d'affichage partagés (prix, notes, nombres) — français de Tunisie.
 */

const integerFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const decimalFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ratingFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Remplace l'espace insécable fine de Intl par une espace insécable simple (rendu homogène). */
const clean = (text) => text.replace(/ /g, ' ')

/** 2.4 → « 2,40 » ; 18 → « 18 » ; 12400 → « 12 400 ». */
export function formatAmount(value) {
  const number = Number(value ?? 0)
  return clean(Number.isInteger(number) ? integerFormat.format(number) : decimalFormat.format(number))
}

/** « 2,40 TND » */
export function formatPrice(value) {
  return `${formatAmount(value)} TND`
}

/** « 2,40 TND / pièce » (sans unité : « 9 800 TND »). */
export function formatPriceWithUnit(value, unit) {
  return unit ? `${formatPrice(value)} / ${unit}` : formatPrice(value)
}

/** 4.6 → « 4,6 » */
export function formatRating(value) {
  return ratingFormat.format(Number(value ?? 0))
}

/** 1240 → « 1 240 » */
export function formatNumber(value) {
  return clean(integerFormat.format(Number(value ?? 0)))
}

/** « 1 produit », « 312 produits » */
export function pluralize(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${Number(count) > 1 ? plural : singular}`
}
