/**
 * API simulée pour les tests de bout en bout : chaque test décrit les réponses dont il a besoin, toute autre
 * requête GET reçoit une liste vide (compteurs, notifications…). Les requêtes envoyées sont enregistrées
 * pour vérifier ce que l'interface transmet réellement à l'API.
 */
const API = 'http://api.test/api'

export const BUYER = { id: 1, name: 'Sana Ben Salah', first_name: 'Sana', last_name: 'Ben Salah', email: 'sana@tijaralink.test', role: 'buyer', email_verified: true, status: 'actif' }
export const SUPPLIER = {
  id: 2,
  name: 'Atlas Emballages',
  first_name: 'Amel',
  last_name: 'Atlas',
  email: 'atlas@tijaralink.test',
  role: 'supplier',
  email_verified: true,
  status: 'actif',
  supplier_validation_status: 'validé',
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ user?: object|null, routes?: Record<string, (request: { method: string, body: any, url: URL }) => any> }} options
 *   routes : « MÉTHODE /chemin » → fonction qui renvoie le corps JSON, ou { status, body }.
 */
export async function mockApi(page, { user = null, routes = {} } = {}) {
  const calls = []

  if (user) {
    await page.addInitScript(() => window.localStorage.setItem('mb2b_token', 'jeton-e2e'))
  }

  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api', '')
    const method = request.method()
    let body = null
    try {
      body = request.postDataJSON()
    } catch {
      body = request.postData()
    }
    calls.push({ method, path, body })

    const key = `${method} ${path}`
    let result
    if (key === 'GET /auth/me') result = user ?? { status: 401, body: { message: 'Non authentifié.' } }
    else if (routes[key]) result = routes[key]({ method, body, url })
    else if (method === 'GET') result = path.endsWith('count') ? { count: 0, unread: 0 } : { data: [], meta: { current_page: 1, last_page: 1, total: 0 } }
    else result = { message: 'OK' }

    const isWrapped = result && typeof result === 'object' && 'status' in result && 'body' in result && Object.keys(result).length === 2
    await route.fulfill({
      status: isWrapped ? result.status : 200,
      contentType: 'application/json',
      body: JSON.stringify(isWrapped ? result.body : result),
    })
  })

  return calls
}
