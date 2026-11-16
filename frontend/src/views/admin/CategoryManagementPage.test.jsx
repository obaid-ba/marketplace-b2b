import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  reorderAdminCategories,
  updateAdminCategory,
} from '@/api/adminCategories'
import CategoryManagementPage from './CategoryManagementPage'

vi.mock('@/api/adminCategories', () => ({
  fetchAdminCategories: vi.fn(),
  createAdminCategory: vi.fn(),
  updateAdminCategory: vi.fn(),
  reorderAdminCategories: vi.fn(),
  deleteAdminCategory: vi.fn(),
}))

function mockCategoryTree() {
  return [
    {
      id: 1,
      parent_id: null,
      name: 'Matériaux & Équipements',
      position: 1,
      products_count: 5,
      tenders_count: 2,
      children: [
        {
          id: 11,
          parent_id: 1,
          name: 'Ciment et Béton',
          position: 1,
          products_count: 3,
          tenders_count: 1,
        },
        {
          id: 12,
          parent_id: 1,
          name: 'Outillage',
          position: 2,
          products_count: 2,
          tenders_count: 1,
        },
      ],
    },
    {
      id: 2,
      parent_id: null,
      name: 'Services Numériques',
      position: 2,
      products_count: 0,
      tenders_count: 0,
      children: [],
    },
  ]
}

describe('CategoryManagementPage (SCRUM-32 / F06)', () => {
  beforeEach(() => {
    vi.mocked(fetchAdminCategories).mockResolvedValue(mockCategoryTree())
    vi.mocked(createAdminCategory).mockResolvedValue({
      message: 'Catégorie créée avec succès.',
      category: { id: 99, name: 'Nouvelle Cat', parent_id: null, position: 3 },
    })
    vi.mocked(updateAdminCategory).mockResolvedValue({
      message: 'Catégorie mise à jour avec succès.',
      category: { id: 1, name: 'Matériaux Modifié', parent_id: null, position: 1 },
    })
    vi.mocked(reorderAdminCategories).mockResolvedValue({
      message: 'Ordre des catégories mis à jour avec succès.',
    })
    vi.mocked(deleteAdminCategory).mockResolvedValue({
      message: 'La catégorie a été supprimée avec succès.',
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('affiche l’arborescence des catégories, les sous-catégories et les compteurs', async () => {
    render(<CategoryManagementPage />)

    expect(screen.getByText('Chargement des catégories...')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('Matériaux & Équipements')).toBeTruthy()
      expect(screen.getByText('Ciment et Béton')).toBeTruthy()
      expect(screen.getByText('Outillage')).toBeTruthy()
      expect(screen.getByText('Services Numériques')).toBeTruthy()
      // Badges compteurs
      expect(screen.getAllByText(/5 produits/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/2 demandes/i).length).toBeGreaterThan(0)
    })

    expect(fetchAdminCategories).toHaveBeenCalledTimes(1)
  })

  it('permet de créer une catégorie principale via la modale', async () => {
    render(<CategoryManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('Matériaux & Équipements')).toBeTruthy()
    })

    const createBtn = screen.getByRole('button', { name: '+ Nouvelle catégorie' })
    fireEvent.click(createBtn)

    // Vérifie que la modale est ouverte
    expect(screen.getByRole('heading', { name: 'Créer une catégorie principale' })).toBeTruthy()

    const input = screen.getByLabelText(/Nom de la catégorie/i)
    fireEvent.change(input, { target: { value: 'Transport & Logistique' } })

    const submitBtn = screen.getByRole('button', { name: 'Enregistrer' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(createAdminCategory).toHaveBeenCalledWith({
        name: 'Transport & Logistique',
        parent_id: null,
      })
    })
  })

  it('permet de créer une sous-catégorie rattachée à son parent', async () => {
    render(<CategoryManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('Matériaux & Équipements')).toBeTruthy()
    })

    const subCatButtons = screen.getAllByRole('button', { name: '+ Sous-catégorie' })
    fireEvent.click(subCatButtons[0])

    expect(screen.getByRole('heading', { name: 'Ajouter une sous-catégorie' })).toBeTruthy()

    const input = screen.getByLabelText(/Nom de la catégorie/i)
    fireEvent.change(input, { target: { value: 'Briques et Tuiles' } })

    const submitBtn = screen.getByRole('button', { name: 'Enregistrer' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(createAdminCategory).toHaveBeenCalledWith({
        name: 'Briques et Tuiles',
        parent_id: 1,
      })
    })
  })

  it('permet de renommer une catégorie existante', async () => {
    render(<CategoryManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('Matériaux & Équipements')).toBeTruthy()
    })

    const renameButtons = screen.getAllByRole('button', { name: 'Renommer' })
    fireEvent.click(renameButtons[0])

    expect(screen.getByRole('heading', { name: 'Renommer la catégorie' })).toBeTruthy()

    const input = screen.getByLabelText(/Nom de la catégorie/i)
    fireEvent.change(input, { target: { value: 'Gros Œuvre & BTP' } })

    const submitBtn = screen.getByRole('button', { name: 'Enregistrer' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(updateAdminCategory).toHaveBeenCalledWith(1, {
        name: 'Gros Œuvre & BTP',
      })
    })
  })

  it('permet de réordonner les catégories principales vers le haut ou vers le bas', async () => {
    render(<CategoryManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('Matériaux & Équipements')).toBeTruthy()
    })

    const moveDownButtons = screen.getAllByTitle('Descendre')
    fireEvent.click(moveDownButtons[0])

    await waitFor(() => {
      expect(reorderAdminCategories).toHaveBeenCalledWith([
        { id: 2, position: 1, parent_id: null },
        { id: 1, position: 2, parent_id: null },
      ])
    })
  })

  it('bloque la suppression avec un message explicite si la catégorie est utilisée', async () => {
    const errorResponse = {
      response: {
        status: 422,
        data: {
          message: 'Impossible de supprimer cette catégorie car elle est utilisée par 5 produit(s) et 2 demande(s).',
          reason: 'category_in_use',
        },
      },
    }
    vi.mocked(deleteAdminCategory).mockRejectedValueOnce(errorResponse)

    render(<CategoryManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('Matériaux & Équipements')).toBeTruthy()
    })

    const deleteButtons = screen.getAllByRole('button', { name: 'Supprimer' })
    fireEvent.click(deleteButtons[0])

    expect(screen.getByRole('heading', { name: 'Supprimer « Matériaux & Équipements » ?' })).toBeTruthy()

    const confirmBtn = screen.getByRole('button', { name: 'Confirmer la suppression' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteAdminCategory).toHaveBeenCalledWith(1)
      expect(
        screen.getAllByText(/Impossible de supprimer cette catégorie car elle est utilisée par 5 produit\(s\) et 2 demande\(s\)\./i).length
      ).toBeGreaterThan(0)
    })
  })

  it('supprime avec succès une catégorie vide / inutilisée', async () => {
    render(<CategoryManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('Services Numériques')).toBeTruthy()
    })

    const deleteButtons = screen.getAllByRole('button', { name: 'Supprimer' })
    // Category 2 is the second main category (index 3 because index 0 is cat 1, index 1 & 2 are its children)
    fireEvent.click(deleteButtons[3])

    const confirmBtn = screen.getByRole('button', { name: 'Confirmer la suppression' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteAdminCategory).toHaveBeenCalledWith(2)
    })
  })
})
