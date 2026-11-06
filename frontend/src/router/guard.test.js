import { describe, expect, it } from 'vitest'
import { resolveAccess } from './guard'

const guest = { isAuthenticated: false, role: null }
const supplier = { isAuthenticated: true, role: 'supplier' }
const buyer = { isAuthenticated: true, role: 'buyer' }

const supplierPage = { fullPath: '/fournisseur', meta: { roles: ['supplier'] } }
const loginPage = { fullPath: '/connexion', meta: { guest: true } }
const publicPage = { fullPath: '/', meta: {} }

describe('resolveAccess', () => {
  it('laisse passer tout le monde sur une page publique', () => {
    expect(resolveAccess(publicPage, guest)).toBe(true)
    expect(resolveAccess(publicPage, buyer)).toBe(true)
  })

  it('renvoie un visiteur vers la connexion en gardant la page demandée', () => {
    expect(resolveAccess(supplierPage, guest)).toEqual({
      name: 'login',
      query: { redirect: '/fournisseur' },
    })
  })

  it("autorise le bon rôle et refuse les autres", () => {
    expect(resolveAccess(supplierPage, supplier)).toBe(true)
    expect(resolveAccess(supplierPage, buyer)).toEqual({ name: 'forbidden' })
  })

  it('renvoie un utilisateur connecté vers son tableau de bord depuis la page de connexion', () => {
    expect(resolveAccess(loginPage, buyer)).toEqual({ name: 'buyer.dashboard' })
    expect(resolveAccess(loginPage, guest)).toBe(true)
  })
})
