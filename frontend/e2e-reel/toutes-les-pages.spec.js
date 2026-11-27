import { expect, test } from '@playwright/test'

/**
 * Toutes les pages de la plateforme, ouvertes avec les vrais comptes de démonstration (mot de passe « password »).
 * Pour chaque page : pas d'erreur JavaScript, pas de réponse 5xx de l'API, pas de requête refusée par erreur,
 * pas d'image cassée, un titre affiché, pas de renvoi vers « Accès refusé » ou la connexion, et sur téléphone
 * (360 px) pas de défilement horizontal.
 * Les pages de détail (commande, demande, litige…) utilisent le premier élément renvoyé par l'API.
 */
const API = process.env.E2E_API_URL ?? 'http://localhost:8000/api'
const DOMAIN = process.env.E2E_DOMAIN ?? 'tijaralink.test'
const TOKEN_KEY = 'mb2b_token'

/** Pages d'erreur de l'application : leur titre signale un problème. */
const ERROR_TITLES = ['Page introuvable', 'Accès refusé', 'Une erreur est survenue', 'Connexion interrompue']

async function login(request, email) {
  const response = await request.post(`${API}/auth/login`, { data: { email, password: 'password' } })
  expect(response.status(), `connexion de ${email}`).toBe(200)
  return (await response.json()).token
}

/** Identifiant du premier élément d'une liste de l'API (tableau ou page { data: [...] }). */
async function firstId(request, token, path, pick = (item) => item.id) {
  const response = await request.get(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!response.ok()) return null
  const json = await response.json()
  const list = Array.isArray(json) ? json : (json.data ?? json.items ?? json.orders ?? json.conversations ?? [])
  return list.length ? pick(list[0]) : null
}

/**
 * Ouvre chaque page et renvoie la liste des problèmes trouvés (vide = tout va bien).
 * @param {import('@playwright/test').Page} page
 */
async function visitAll(page, paths, { mobile, allowedStatus = () => false }) {
  const problems = []
  let current = ''
  page.on('pageerror', (error) => problems.push(`${current} : erreur JavaScript « ${error.message} »`))
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) {
      problems.push(`${current} : console « ${message.text().slice(0, 200)} »`)
    }
  })
  page.on('response', (response) => {
    const url = new URL(response.url())
    const status = response.status()
    if (!url.href.startsWith(API) || status < 400) return
    if (allowedStatus(status, url.pathname.replace(/^\/api/, ''))) return
    problems.push(`${current} : ${response.request().method()} ${url.pathname} → ${status}`)
  })

  for (const path of paths) {
    current = path
    // Une étape par page : en cas de blocage, le rapport nomme la page.
    await test.step(path, async () => {
      await page.goto(path)
      // Les pages se rafraîchissent à intervalle régulier : on attend le titre, pas la fin du réseau.
      const heading = page.locator('h1').first()
      const shown = await heading.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false)
      await page.waitForTimeout(1_000) // laisse finir les requêtes de la page (images, compteurs)

      const finalPath = new URL(page.url()).pathname
      if (/^\/(connexion|acces-refuse)/.test(finalPath) && !path.startsWith(finalPath)) {
        problems.push(`${path} : renvoyé vers ${finalPath}`)
        return
      }
      if (!shown) {
        problems.push(`${path} : aucun titre (h1) affiché`)
      } else {
        const title = (await heading.textContent())?.trim() ?? ''
        if (ERROR_TITLES.includes(title)) problems.push(`${path} : page d'erreur « ${title} »`)
      }

      const broken = await page.$$eval('img', (images) =>
        images.filter((img) => img.complete && img.naturalWidth === 0 && img.getAttribute('src')).map((img) => img.getAttribute('src')),
      )
      for (const src of broken) problems.push(`${path} : image cassée ${src}`)

      if (mobile) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        if (overflow > 1) problems.push(`${path} : défilement horizontal de ${overflow} px sur téléphone`)
      }
    }, { timeout: 30_000 })
  }
  return problems
}

async function signIn(page, request, email) {
  const token = await login(request, email)
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [TOKEN_KEY, token])
  return token
}

const isMobile = (testInfo) => testInfo.project.name.startsWith('mobile')
const viewportOf = (testInfo) => testInfo.project.use.viewport

test('visiteur : pages publiques', async ({ page, request }, testInfo) => {
  const productId = await firstId(request, null, '/products')
  const supplierId = await firstId(request, null, '/suppliers')
  const paths = [
    '/',
    '/catalogue',
    '/fournisseurs',
    productId && `/produits/${productId}`,
    supplierId && `/fournisseurs/${supplierId}`,
    '/connexion',
    '/inscription',
    '/inscription/porteur',
    '/inscription/fournisseur',
    '/mot-de-passe-oublie',
  ].filter(Boolean)

  expect(productId, 'au moins un produit publié').toBeTruthy()
  expect(supplierId, 'au moins un fournisseur publié').toBeTruthy()
  // Un visiteur n'est pas connecté : /auth/me répond 401, c'est normal.
  const problems = await visitAll(page, paths, {
    mobile: isMobile(testInfo),
    allowedStatus: (status, path) => status === 401 && path === '/auth/me',
  })
  expect(problems).toEqual([])
})

test('porteur de projet : toutes ses pages', async ({ page, request }, testInfo) => {
  const token = await signIn(page, request, `sana@${DOMAIN}`)
  const tenderId = await firstId(request, token, '/buyer/tenders')
  const orderId = await firstId(request, token, '/buyer/orders')
  const conversationId = await firstId(request, token, '/conversations')

  const paths = [
    '/porteur',
    '/porteur/demandes',
    '/porteur/demandes/nouvelle',
    tenderId && `/porteur/demandes/${tenderId}`,
    tenderId && `/porteur/devis/${tenderId}/comparer`,
    '/porteur/commandes',
    orderId && `/porteur/commandes/${orderId}`,
    orderId && `/orders/${orderId}`,
    '/porteur/favoris',
    '/porteur/messagerie',
    conversationId && `/porteur/messagerie/${conversationId}`,
    '/porteur/litiges',
    '/porteur/notifications',
    '/porteur/assistant-ia',
    '/parametres',
    '/parametres/notifications',
    '/catalogue',
  ].filter(Boolean)

  for (const [name, id] of Object.entries({ tenderId, orderId, conversationId })) {
    expect(id, `données de démonstration : ${name}`).toBeTruthy()
  }
  expect(await visitAll(page, paths, { mobile: isMobile(testInfo) })).toEqual([])
})

test('fournisseur : toutes ses pages', async ({ page, request }, testInfo) => {
  const token = await signIn(page, request, `atlas@${DOMAIN}`)
  const tenderId = await firstId(request, token, '/supplier/tenders', (item) => item.tender?.id)
  const productId = await firstId(request, token, '/supplier/products')
  const orderId = await firstId(request, token, '/supplier/orders')
  const conversationId = await firstId(request, token, '/conversations')

  const paths = [
    '/fournisseur',
    '/fournisseur/profil',
    '/fournisseur/demandes',
    tenderId && `/fournisseur/demandes/${tenderId}`,
    '/fournisseur/devis',
    '/fournisseur/produits',
    '/fournisseur/produits/nouveau',
    productId && `/fournisseur/produits/${productId}/modifier`,
    '/fournisseur/commandes',
    orderId && `/orders/${orderId}`,
    '/fournisseur/avis',
    '/fournisseur/messagerie',
    conversationId && `/fournisseur/messagerie/${conversationId}`,
    '/fournisseur/litiges',
    '/fournisseur/notifications',
    '/fournisseur/assistant-ia',
    '/parametres',
    '/parametres/notifications',
  ].filter(Boolean)

  for (const [name, id] of Object.entries({ tenderId, productId, orderId, conversationId })) {
    expect(id, `données de démonstration : ${name}`).toBeTruthy()
  }
  expect(await visitAll(page, paths, { mobile: isMobile(testInfo) })).toEqual([])
})

test('administrateur : toutes ses pages', async ({ page, request }, testInfo) => {
  const token = await signIn(page, request, `admin@${DOMAIN}`)
  const userId = await firstId(request, token, '/admin/users')
  const disputeId = await firstId(request, token, '/admin/disputes')

  const paths = [
    '/admin',
    '/admin/fournisseurs',
    '/admin/categories',
    '/admin/utilisateurs',
    userId && `/admin/utilisateurs/${userId}`,
    '/admin/catalogue',
    '/admin/avis',
    '/admin/litiges',
    disputeId && `/admin/litiges/${disputeId}`,
    '/admin/journal',
    '/admin/notifications',
    '/parametres',
  ].filter(Boolean)

  expect(userId, 'au moins un utilisateur').toBeTruthy()
  expect(disputeId, 'au moins un litige').toBeTruthy()
  expect(await visitAll(page, paths, { mobile: isMobile(testInfo) })).toEqual([])
})

test('litige : le porteur et le fournisseur concernés ouvrent le même litige', async ({ browser, request }, testInfo) => {
  const adminToken = await login(request, `admin@${DOMAIN}`)
  const response = await request.get(`${API}/admin/disputes`, { headers: { Authorization: `Bearer ${adminToken}` } })
  const dispute = (await response.json()).data?.[0]
  expect(dispute, 'au moins un litige dans les données de démonstration').toBeTruthy()

  const parties = [
    [dispute.buyer?.contact?.email, '/porteur/litiges'],
    [dispute.supplier?.contact?.email, '/fournisseur/litiges'],
  ]
  for (const [email, listPath] of parties) {
    expect(email, 'contact de chaque partie du litige').toBeTruthy()
    const context = await browser.newContext({ viewport: viewportOf(testInfo) })
    const page = await context.newPage()
    await signIn(page, request, email)
    const problems = await visitAll(page, [listPath, `/litiges/${dispute.id}`], { mobile: isMobile(testInfo) })
    await context.close()
    expect(problems, email).toEqual([])
  }
})

test("fournisseur en attente : n'accède qu'à son dossier", async ({ page, request }) => {
  // supplier7 est « en attente » dans DatabaseSeeder.
  await signIn(page, request, `supplier7@${DOMAIN}`)
  await page.goto('/fournisseur/produits')
  await expect(page).toHaveURL(/\/fournisseur\/en-attente/)
  await expect(page.locator('h1').first()).toBeVisible()
})

test('les espaces sont fermés aux autres rôles', async ({ page, request }) => {
  await signIn(page, request, `sana@${DOMAIN}`)
  for (const path of ['/admin', '/fournisseur/produits']) {
    await page.goto(path)
    await expect(page, `${path} ouvert à un porteur`).not.toHaveURL(new RegExp(`${path}$`))
  }
})

test('une adresse inconnue affiche la page 404', async ({ page }) => {
  await page.goto('/cette-page-n-existe-pas')
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible()
})
