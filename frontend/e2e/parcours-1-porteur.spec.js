import { expect, test } from '@playwright/test'
import { BUYER, mockApi } from './support/api'

/**
 * Parcours 1 — porteur de projet (SCRUM-89) : publier une demande, comparer les devis reçus, accepter un devis
 * et arriver sur la commande créée.
 */
const CATEGORIES = [
  { id: 1, parent_id: null, name: 'Emballage et conditionnement', position: 1 },
  { id: 2, parent_id: 1, name: 'Cartonnage', position: 1 },
]
const REGIONS = [{ id: 12, name: 'Sfax' }]

const tender = {
  id: 41,
  title: 'Cartons ondulés pour huile',
  description: 'Nous cherchons 5000 cartons ondulés double cannelure pour expédier nos bouteilles.',
  status: 'ouverte',
  status_label: 'Ouverte',
  budget: 4000,
  desired_deadline: null,
  created_at: '2027-01-24T10:00:00+01:00',
  category: { id: 2, name: 'Cartonnage' },
  region: { id: 12, name: 'Sfax' },
  attachments: [],
  ai_keywords: [],
  quotes_count: 2,
  recipients_count: 2,
  notified_count: 2,
}

const quote = (id, company, amount, days) => ({
  id,
  tender_id: 41,
  amount,
  delivery_days: days,
  conditions: null,
  comment: null,
  status: 'envoyé',
  status_label: 'Envoyé',
  created_at: '2027-01-25T10:00:00+01:00',
  supplier: { id: id + 100, company_name: company, rating_avg: 4.5, reviews_count: 10, region: { name: 'Sfax' } },
})

test('publier une demande, comparer les devis et en accepter un', async ({ page }) => {
  const calls = await mockApi(page, {
    user: BUYER,
    routes: {
      'GET /reference/categories': () => CATEGORIES,
      'GET /reference/regions': () => REGIONS,
      'POST /buyer/tenders': () => ({ status: 201, body: tender }),
      'GET /buyer/tenders/41': () => tender,
      'GET /buyer/favorites': () => [],
      'GET /buyer/tenders/41/quotes': () => [quote(7, 'Atlas Emballages', '3800.00', 10), quote(8, 'Djerba Pack', '3200.00', 15)],
      'GET /buyer/tenders/41/quotes/summary': () => ({ can_generate: false, summary: null }),
      'GET /buyer/tenders/41/market-price': () => ({ status: 'insufficient', transactions: 1, min_transactions: 3, months: 12, category: 'Cartonnage' }),
      'POST /buyer/quotes/7/accept': () => ({ status: 201, body: { id: 90, status: 'validée', origin: 'devis', total: 3800 } }),
      'GET /buyer/orders/90': () => ({ order: { id: 90, status: 'validée', status_label: 'Validée', total: '3800.00', items: [], history: [], supplier: { id: 107, company_name: 'Atlas Emballages' } } }),
      'GET /orders/90': () => ({ order: { id: 90, status: 'validée', status_label: 'Validée', total: '3800.00', items: [], history: [], supplier: { id: 107, company_name: 'Atlas Emballages' } } }),
    },
  })

  // 1. Publier la demande.
  await page.goto('/porteur/demandes/nouvelle')
  await expect(page.getByRole('heading', { name: 'Publier une demande' })).toBeVisible()
  await page.getByLabel('Titre de la demande *').fill(tender.title)
  await page.getByLabel('Description du besoin *').fill(tender.description)
  await page.getByLabel('Catégorie *').selectOption('2')
  await page.getByLabel('Région').selectOption('12')
  await page.getByLabel('Budget indicatif (TND)').fill('4000')
  await page.getByRole('button', { name: 'Publier la demande' }).click()

  await expect(page).toHaveURL(/\/porteur\/demandes\/41$/)
  await expect(page.getByText('Votre demande est publiée.', { exact: false })).toBeVisible()
  const published = calls.find((call) => call.method === 'POST' && call.path === '/buyer/tenders')
  expect(published).toBeTruthy()

  // 2. Comparer les devis reçus.
  await page.getByRole('link', { name: /Comparer les devis/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Atlas Emballages' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Djerba Pack' })).toBeVisible()
  await expect(page.getByText('Données insuffisantes', { exact: false })).toBeVisible()

  // 3. Accepter le devis d'Atlas (confirmation du navigateur) : la commande est créée.
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Accepter ce devis' }).first().click()

  await expect(page).toHaveURL(/\/porteur\/commandes\/90$/)
  expect(calls.some((call) => call.method === 'POST' && call.path === '/buyer/quotes/7/accept')).toBe(true)
})

test('la saisie d’une demande survit à une coupure réseau', async ({ page, context }) => {
  await mockApi(page, {
    user: BUYER,
    routes: { 'GET /reference/categories': () => CATEGORIES, 'GET /reference/regions': () => REGIONS },
  })

  await page.goto('/porteur/demandes/nouvelle')
  await page.getByLabel('Titre de la demande *').fill('Palettes bois 120x80')

  await context.setOffline(true)
  await expect(page.getByText('Vous êtes hors ligne', { exact: false })).toBeVisible()
  await context.setOffline(false)

  await page.reload()
  await expect(page.getByLabel('Titre de la demande *')).toHaveValue('Palettes bois 120x80')
  await expect(page.getByText('Votre saisie précédente a été restaurée.')).toBeVisible()
})
