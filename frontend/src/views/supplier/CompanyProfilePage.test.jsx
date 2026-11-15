import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import * as api from '@/api/supplierProfile'
import { useAuthStore } from '@/stores/auth'
import CompanyProfilePage from './CompanyProfilePage'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/supplierProfile', () => ({
  fetchSupplierProfile: vi.fn(),
  fetchProfileReferences: vi.fn(),
  updateSupplierProfile: vi.fn(),
  uploadSupplierLogo: vi.fn(),
  setSupplierProfilePublished: vi.fn(),
  addSupplierDocument: vi.fn(),
  openSupplierDocument: vi.fn(),
}))

const references = {
  regions: [
    { id: 1, name: 'Sfax' },
    { id: 2, name: 'Tunis' },
  ],
  categories: [
    { id: 10, parent_id: null, name: 'Emballage', position: 1 },
    { id: 20, parent_id: null, name: 'Logistique', position: 2 },
  ],
  sectors: ['Emballage et conditionnement', 'Autre'],
}

function profile(overrides = {}) {
  return {
    id: 7,
    company_name: 'Atlas Emballages',
    logo_url: null,
    description: 'Carton ondulé.',
    sector: 'Emballage et conditionnement',
    region_id: 1,
    professional_phone: '+216 74000000',
    professional_email: 'contact@atlas.tn',
    categories: [{ id: 10, parent_id: null, name: 'Emballage' }],
    coverage_regions: [{ id: 1, name: 'Sfax' }],
    validation_status: 'validé',
    is_published: true,
    can_publish: true,
    rating_avg: 4.6,
    reviews_count: 38,
    documents: [{ id: 3, file_name: 'Registre de commerce.pdf', status: 'validé' }],
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <CompanyProfilePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 1, role: 'supplier', email_verified: true, supplier_company_name: 'Atlas Emballages' },
    token: 't',
    loaded: true,
  })
  api.fetchProfileReferences.mockResolvedValue(references)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Profil de l’entreprise (SCRUM-28)', () => {
  it('affiche le chargement puis le formulaire pré-rempli', async () => {
    api.fetchSupplierProfile.mockResolvedValue(profile())
    renderPage()

    expect(screen.getByRole('status').textContent).toContain('Chargement')
    expect((await screen.findByLabelText('Nom de l’entreprise')).value).toBe('Atlas Emballages')
    expect(screen.getByLabelText('Gouvernorat').value).toBe('1')
    expect(screen.getByLabelText('Sfax').checked).toBe(true)
    expect(screen.getByText('Validé par l’admin')).toBeTruthy()
    expect(screen.getByText('4,6 / 5 - 38 avis')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Registre de commerce.pdf' })).toBeTruthy()
  })

  it('enregistre le profil et affiche un message de succès', async () => {
    api.fetchSupplierProfile.mockResolvedValue(profile())
    api.updateSupplierProfile.mockResolvedValue({
      message: 'Le profil de votre entreprise a été enregistré.',
      profile: profile({ company_name: 'Atlas Pack' }),
    })
    renderPage()

    fireEvent.change(await screen.findByLabelText('Nom de l’entreprise'), { target: { value: 'Atlas Pack' } })
    fireEvent.click(screen.getByLabelText('Tunis'))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Le profil de votre entreprise a été enregistré.')).toBeTruthy()
    expect(api.updateSupplierProfile).toHaveBeenCalledWith(
      expect.objectContaining({ company_name: 'Atlas Pack', region_id: 1, categories: [10], coverage_regions: [1, 2] }),
    )
    expect(useAuthStore.getState().user.supplier_company_name).toBe('Atlas Pack')
  })

  it('affiche les erreurs 422 sous chaque champ sans perdre la saisie', async () => {
    api.fetchSupplierProfile.mockResolvedValue(profile())
    api.updateSupplierProfile.mockRejectedValue(
      Object.assign(new Error('422'), {
        userMessage: 'Certains champs sont invalides.',
        fieldErrors: {
          company_name: ["Le nom de l'entreprise est obligatoire."],
          'coverage_regions.0': ['Une des zones couvertes est invalide.'],
        },
      }),
    )
    renderPage()

    const name = await screen.findByLabelText('Nom de l’entreprise')
    fireEvent.change(name, { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Nouvelle description' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText("Le nom de l'entreprise est obligatoire.")).toBeTruthy()
    expect(screen.getByText('Une des zones couvertes est invalide.')).toBeTruthy()
    expect(screen.getByText('Certains champs sont invalides.')).toBeTruthy()
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('Description').value).toBe('Nouvelle description')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enregistrer' }).disabled).toBe(false))
  })

  it('bloque l’interrupteur de publication tant que le compte n’est pas validé', async () => {
    api.fetchSupplierProfile.mockResolvedValue(
      profile({ validation_status: 'en attente', is_published: false, can_publish: false }),
    )
    renderPage()

    const toggle = await screen.findByRole('switch', { name: 'Profil publié' })
    expect(toggle.disabled).toBe(true)
    expect(screen.getByText('Disponible après validation de votre compte.')).toBeTruthy()
    expect(screen.getByText('En attente')).toBeTruthy()
  })

  it('publie le profil d’un fournisseur validé', async () => {
    api.fetchSupplierProfile.mockResolvedValue(profile({ is_published: false }))
    api.setSupplierProfilePublished.mockResolvedValue({ profile: profile({ is_published: true }) })
    renderPage()

    const toggle = await screen.findByRole('switch', { name: 'Profil publié' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)

    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'))
    expect(api.setSupplierProfilePublished).toHaveBeenCalledWith(true)
  })

  it('retire une catégorie proposée', async () => {
    api.fetchSupplierProfile.mockResolvedValue(profile())
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Retirer Emballage' }))
    expect(screen.queryByRole('button', { name: 'Retirer Emballage' })).toBeNull()
  })

  it('affiche une erreur si le profil ne peut pas être chargé', async () => {
    api.fetchSupplierProfile.mockRejectedValue(Object.assign(new Error('x'), { userMessage: 'Erreur du serveur.' }))
    renderPage()

    expect(await screen.findByText('Erreur du serveur.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy()
  })
})
