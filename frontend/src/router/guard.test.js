import { describe, expect, it } from 'vitest'
import { resolveAccess } from './guard'
import { safeRedirect } from './paths'

const guest = { isAuthenticated: false, role: null }
const supplier = { isAuthenticated: true, role: 'supplier' }
const buyer = { isAuthenticated: true, role: 'buyer' }

const supplierOnly = { roles: ['supplier'] }
const guestOnly = { guest: true }

describe('resolveAccess', () => {
  it('laisse passer tout le monde sur une page publique', () => {
    expect(resolveAccess('/', {}, guest)).toBe(true)
    expect(resolveAccess('/', {}, buyer)).toBe(true)
  })

  it('renvoie un visiteur vers la connexion en gardant la page demandée', () => {
    expect(resolveAccess('/fournisseur', supplierOnly, guest)).toBe('/connexion?redirect=%2Ffournisseur')
  })

  it('autorise le bon rôle et refuse les autres', () => {
    expect(resolveAccess('/fournisseur', supplierOnly, supplier)).toBe(true)
    expect(resolveAccess('/fournisseur', supplierOnly, buyer)).toBe('/acces-refuse')
  })

  it('renvoie un utilisateur connecté vers son tableau de bord depuis la page de connexion', () => {
    expect(resolveAccess('/connexion', guestOnly, buyer)).toBe('/porteur')
    expect(resolveAccess('/connexion', guestOnly, guest)).toBe(true)
  })
})

describe('safeRedirect', () => {
  it("n'accepte que les adresses internes", () => {
    expect(safeRedirect('/porteur?page=2')).toBe('/porteur?page=2')
    expect(safeRedirect('//evil.example')).toBeNull()
    expect(safeRedirect('https://evil.example')).toBeNull()
    expect(safeRedirect(null)).toBeNull()
  })
})
