import { expect, test } from '@playwright/test'
import { SUPPLIER, mockApi } from './support/api'

/**
 * Parcours 2 — fournisseur (SCRUM-89) : voir les demandes reçues, ouvrir une demande et envoyer un devis.
 */
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
  buyer: { organization: 'Huilerie du Sahel' },
}

const received = (myQuote = null) => ({
  recipient_id: 5,
  score: 85,
  source: 'automatique',
  notified_at: '2027-01-24T10:00:00+01:00',
  seen_at: null,
  already_responded: myQuote !== null,
  my_quote: myQuote,
  tender,
})

test('consulter une demande reçue et envoyer un devis', async ({ page }) => {
  const calls = await mockApi(page, {
    user: SUPPLIER,
    routes: {
      'GET /supplier/tenders': () => ({ data: [received()], meta: { current_page: 1, last_page: 1, total: 1 } }),
      'GET /supplier/tenders/41': () => received(),
      'POST /supplier/tenders/41/quote': ({ body }) => ({
        status: 201,
        body: { id: 7, tender_id: 41, ...body, status: 'envoyé', status_label: 'Envoyé' },
      }),
    },
  })

  await page.goto('/fournisseur/demandes')
  await expect(page.getByText('Cartons ondulés pour huile').first()).toBeVisible()
  await page.getByRole('link', { name: 'Cartons ondulés pour huile' }).first().click()

  await expect(page).toHaveURL(/\/fournisseur\/demandes\/41$/)
  await page.locator('#amount').fill('3800')
  await page.locator('#delivery_days').fill('10')
  await page.locator('#conditions').fill('Paiement à 30 jours')
  await page.getByRole('button', { name: 'Envoyer le devis' }).click()

  await expect(page.getByText('Votre devis est envoyé.', { exact: false })).toBeVisible()
  const sent = calls.find((call) => call.method === 'POST' && call.path === '/supplier/tenders/41/quote')
  expect(sent.body).toMatchObject({ amount: '3800', delivery_days: '10', conditions: 'Paiement à 30 jours' })
})

test('un visiteur est renvoyé vers la connexion puis la page 404 reste claire', async ({ page }) => {
  await mockApi(page)

  await page.goto('/fournisseur/demandes')
  await expect(page).toHaveURL(/\/connexion\?redirect=%2Ffournisseur%2Fdemandes$/)

  await page.goto('/adresse-inexistante')
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible()
  await expect(page.getByRole('link', { name: "Retour à l'accueil" })).toBeVisible()
})
