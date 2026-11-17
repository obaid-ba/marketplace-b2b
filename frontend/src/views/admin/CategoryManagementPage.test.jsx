import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import * as api from '@/api/adminCategories'
import CategoryManagementPage from './CategoryManagementPage'

vi.mock('@/api/adminCategories', () => ({
  fetchAdminCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  moveCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

const tree = [
  {
    id: 1,
    name: 'Emballage et conditionnement',
    parent_id: null,
    position: 1,
    products_count: 312,
    tenders_count: 0,
    children: [
      { id: 11, name: 'Cartons et caisses', parent_id: 1, position: 1, products_count: 148, tenders_count: 0 },
      { id: 12, name: 'Palettes', parent_id: 1, position: 2, products_count: 1, tenders_count: 0 },
    ],
  },
  { id: 2, name: 'Agroalimentaire', parent_id: null, position: 2, products_count: 0, tenders_count: 0, children: [] },
]

function validationError(errors) {
  const error = new Error('422')
  error.response = { status: 422, data: { message: 'Erreur', errors } }
  return error
}

beforeEach(() => {
  api.fetchAdminCategories.mockResolvedValue(tree)
  globalThis.requestAnimationFrame = (cb) => cb()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CategoryManagementPage', () => {
  it("affiche l'arborescence triée avec le nombre de produits", async () => {
    render(<CategoryManagementPage />)

    const list = await screen.findByRole('list', { name: 'Arborescence des catégories' })
    const items = within(list).getAllByRole('listitem')
    expect(items.map((li) => li.querySelector('p').textContent)).toEqual([
      'Emballage et conditionnement',
      'Cartons et caisses',
      'Palettes',
      'Agroalimentaire',
    ])
    expect(within(items[0]).getAllByText('312 produits').length).toBeGreaterThan(0)
    expect(within(items[2]).getAllByText('1 produit').length).toBeGreaterThan(0)
  })

  it('désactive ↑ sur le premier et ↓ sur le dernier de chaque groupe', async () => {
    render(<CategoryManagementPage />)
    await screen.findByText('Agroalimentaire')

    expect(screen.getByRole('button', { name: 'Monter « Emballage et conditionnement »' })).toHaveProperty("disabled", true)
    expect(screen.getByRole('button', { name: 'Descendre « Agroalimentaire »' })).toHaveProperty("disabled", true)
    expect(screen.getByRole('button', { name: 'Monter « Cartons et caisses »' })).toHaveProperty("disabled", true)
    expect(screen.getByRole('button', { name: 'Descendre « Palettes »' })).toHaveProperty("disabled", true)
    expect(screen.getByRole('button', { name: 'Descendre « Cartons et caisses »' })).toHaveProperty("disabled", false)
  })

  it('monte une catégorie puis recharge la liste', async () => {
    api.moveCategory.mockResolvedValue({ message: 'Ordre mis à jour.' })
    render(<CategoryManagementPage />)
    await screen.findByText('Agroalimentaire')

    fireEvent.click(screen.getByRole('button', { name: 'Monter « Agroalimentaire »' }))

    await waitFor(() => expect(api.moveCategory).toHaveBeenCalledWith(2, { direction: 'up' }))
    await waitFor(() => expect(api.fetchAdminCategories).toHaveBeenCalledTimes(2))
  })

  it('ouvre le panneau de modification pré-rempli et enregistre', async () => {
    api.updateCategory.mockResolvedValue({ category: { id: 11 } })
    render(<CategoryManagementPage />)
    await screen.findByText('Agroalimentaire')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier « Cartons et caisses »' }))

    expect(screen.getByLabelText('Nom')).toHaveProperty('value', 'Cartons et caisses')
    expect(screen.getByLabelText('Catégorie parente')).toHaveProperty('value', '1')
    expect(screen.getByLabelText('Position')).toHaveProperty('value', '1')
    // Une catégorie ne peut pas être sa propre parente : seules les autres racines sont proposées.
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Cartons ondulés' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(api.updateCategory).toHaveBeenCalledWith(11, { name: 'Cartons ondulés', parent_id: 1, position: 1 }),
    )
    expect(await screen.findByText('Catégorie enregistrée.')).toBeTruthy()
  })

  it('ne propose pas la catégorie elle-même comme parente et bloque le parent si elle a des enfants', async () => {
    render(<CategoryManagementPage />)
    await screen.findByText('Agroalimentaire')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier « Emballage et conditionnement »' }))

    const select = screen.getByLabelText('Catégorie parente')
    expect(select).toHaveProperty("disabled", true)
    expect(within(select).queryByRole('option', { name: 'Emballage et conditionnement' })).toBeNull()
    expect(screen.getByText('Contient des sous-catégories : reste une catégorie principale.')).toBeTruthy()
  })

  it('crée une catégorie principale à la fin', async () => {
    api.createCategory.mockResolvedValue({ category: { id: 3 } })
    render(<CategoryManagementPage />)
    await screen.findByText('Agroalimentaire')

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une catégorie' }))
    expect(screen.getByRole('heading', { name: 'Nouvelle catégorie' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Textile' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(api.createCategory).toHaveBeenCalledWith({ name: 'Textile', parent_id: null, position: null }),
    )
  })

  it('affiche les erreurs de validation sous les champs', async () => {
    api.createCategory.mockRejectedValue(
      validationError({ name: ['Une catégorie principale porte déjà ce nom.'] }),
    )
    render(<CategoryManagementPage />)
    await screen.findByText('Agroalimentaire')

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une catégorie' }))
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Agroalimentaire' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Une catégorie principale porte déjà ce nom.')).toBeTruthy()
  })

  it('demande une confirmation avant de supprimer et affiche le refus du serveur', async () => {
    api.deleteCategory.mockRejectedValue(
      validationError({
        category: ['Impossible de supprimer « Palettes » : elle est utilisée par 1 produit.'],
      }),
    )
    render(<CategoryManagementPage />)
    await screen.findByText('Agroalimentaire')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier « Palettes »' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    const dialog = screen.getByRole('dialog', { name: 'Supprimer « Palettes » ?' })
    expect(api.deleteCategory).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(api.deleteCategory).toHaveBeenCalledWith(12))
    expect(
      await screen.findByText('Impossible de supprimer « Palettes » : elle est utilisée par 1 produit.'),
    ).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('supprime une catégorie après confirmation', async () => {
    api.deleteCategory.mockResolvedValue({ message: 'La catégorie « Agroalimentaire » a été supprimée.' })
    render(<CategoryManagementPage />)
    await screen.findByText('Agroalimentaire')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier « Agroalimentaire »' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText('La catégorie « Agroalimentaire » a été supprimée.')).toBeTruthy()
  })

  it("affiche une erreur avec un bouton Réessayer si le chargement échoue", async () => {
    api.fetchAdminCategories.mockRejectedValueOnce(Object.assign(new Error('x'), { userMessage: 'Serveur indisponible.' }))
    render(<CategoryManagementPage />)

    expect(await screen.findByText('Serveur indisponible.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Agroalimentaire')).toBeTruthy()
  })
})
