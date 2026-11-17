import { describe, expect, it } from 'vitest'
import { activeFilterCount, applyChanges, readFilters, toApiParams } from './catalogParams'
import { pageItems } from '@/components/Pagination'
import { formatPriceWithUnit, formatRating } from '@/utils/format'

describe('filtres du catalogue dans l’URL', () => {
  it('lit les filtres et applique le tri par défaut', () => {
    const f = readFilters(new URLSearchParams('q=carton&category=3,5&region=12&price_max=5000&page=2'))
    expect(f.category).toEqual(['3', '5'])
    expect(f.region).toEqual(['12'])
    expect(f.sort).toBe('relevance')
    expect(f.page).toBe(2)
    expect(readFilters(new URLSearchParams('')).sort).toBe('newest')
  })

  it('construit les paramètres API sans valeurs vides', () => {
    const f = readFilters(new URLSearchParams('category=3,5&type=product&delay=7'))
    expect(toApiParams(f)).toEqual({ category: '3,5', type: 'product', delay: '7', sort: 'newest' })
  })

  it('revient en page 1 quand un filtre change, mais pas quand la page change', () => {
    const current = new URLSearchParams('category=3&page=4')
    expect(applyChanges(current, { region: ['12'] }).toString()).toBe('category=3&region=12')
    expect(applyChanges(current, { page: 5 }).get('page')).toBe('5')
    expect(applyChanges(current, { category: [] }).has('category')).toBe(false)
  })

  it('compte les filtres actifs', () => {
    expect(activeFilterCount(readFilters(new URLSearchParams('category=1,2&price_min=0&rating=4&q=x')))).toBe(4)
  })
})

describe('pagination', () => {
  it('affiche toutes les pages quand il y en a peu', () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('résume les longues listes avec des points de suspension', () => {
    expect(pageItems(1, 25)).toEqual([1, 2, 3, 4, 'gap-25', 25])
    expect(pageItems(12, 25)).toEqual([1, 'gap-11', 11, 12, 13, 'gap-25', 25])
  })
})

describe('formats', () => {
  it('formate les prix comme la maquette', () => {
    expect(formatPriceWithUnit(2.4, 'pièce')).toBe('2,40 TND / pièce')
    expect(formatPriceWithUnit(18, 'unité')).toBe('18 TND / unité')
    expect(formatPriceWithUnit(12400, null)).toBe('12 400 TND')
    expect(formatRating(4.6)).toBe('4,6')
  })
})
