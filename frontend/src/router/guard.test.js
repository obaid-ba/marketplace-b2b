import { describe, expect, it } from 'vitest'
import { resolveAccess } from './guard'
import { safeRedirect } from './paths'
import { landingPathFor } from '@/utils/roles'

const guest = null
const supplier = { role: 'supplier', email_verified: true, supplier_validation_status: 'validé' }
const pendingSupplier = { ...supplier, supplier_validation_status: 'en attente' }
const buyer = { role: 'buyer', email_verified: true }
const unverifiedBuyer = { role: 'buyer', email_verified: false }

const supplierOnly = { roles: ['supplier'] }
const supplierDashboard = { roles: ['supplier'], supplierPending: false }
const supplierPendingPage = { roles: ['supplier'], supplierPending: true }
const buyerOnly = { roles: ['buyer'] }
const guestOnly = { guest: true }
const unverifiedOnly = { unverified: true }

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

  it('renvoie un utilisateur connecté vers son espace depuis la page de connexion', () => {
    expect(resolveAccess('/connexion', guestOnly, buyer)).toBe('/porteur')
    expect(resolveAccess('/connexion', guestOnly, unverifiedBuyer)).toBe('/verification-email')
    expect(resolveAccess('/connexion', guestOnly, guest)).toBe(true)
  })
})

describe('resolveAccess — vérification de l’e-mail (SCRUM-24)', () => {
  it('ferme les espaces connectés tant que l’e-mail n’est pas vérifié', () => {
    expect(resolveAccess('/porteur', buyerOnly, unverifiedBuyer)).toBe('/verification-email')
  })

  it('réserve « Consultez votre boîte mail » aux comptes non vérifiés', () => {
    expect(resolveAccess('/verification-email', unverifiedOnly, unverifiedBuyer)).toBe(true)
    expect(resolveAccess('/verification-email', unverifiedOnly, buyer)).toBe('/porteur')
    expect(resolveAccess('/verification-email', unverifiedOnly, guest)).toBe('/connexion?redirect=%2Fverification-email')
  })

  it('envoie un fournisseur non validé sur « Compte en attente », et un fournisseur validé sur son tableau de bord', () => {
    expect(resolveAccess('/fournisseur', supplierDashboard, pendingSupplier)).toBe('/fournisseur/en-attente')
    expect(resolveAccess('/fournisseur/en-attente', supplierPendingPage, pendingSupplier)).toBe(true)
    expect(resolveAccess('/fournisseur/en-attente', supplierPendingPage, supplier)).toBe('/fournisseur')
    expect(resolveAccess('/fournisseur', supplierDashboard, supplier)).toBe(true)
  })

  it('ne boucle pas : la route parente de l’espace fournisseur laisse passer un fournisseur en attente', () => {
    expect(resolveAccess('/fournisseur/en-attente', supplierOnly, pendingSupplier)).toBe(true)
  })
})

describe('landingPathFor', () => {
  it('choisit la page d’arrivée selon l’état du compte', () => {
    expect(landingPathFor(unverifiedBuyer)).toBe('/verification-email')
    expect(landingPathFor(buyer)).toBe('/porteur')
    expect(landingPathFor(pendingSupplier)).toBe('/fournisseur/en-attente')
    expect(landingPathFor(supplier)).toBe('/fournisseur')
    expect(landingPathFor({ role: 'admin', email_verified: true })).toBe('/admin')
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
