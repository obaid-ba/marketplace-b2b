import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import * as api from '@/api/supplierProducts'
import { checkFiles } from './ProductImagesField'
import ProductFormPage from './ProductFormPage'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/categories', () => ({
  fetchCategories: vi.fn().mockResolvedValue([
    { id: 1, name: 'Emballage et conditionnement', children: [{ id: 11, name: 'Cartons et caisses' }] },
  ]),
}))
vi.mock('@/api/supplierProfile', () => ({
  fetchSupplierProfile: vi.fn().mockResolvedValue({ company_name: 'Atlas Emballages', region: { name: 'Sfax' }, rating_avg: 4.6 }),
}))
vi.mock('@/api/supplierProducts', () => ({
  fetchSupplierProduct: vi.fn(),
  createSupplierProduct: vi.fn(),
  updateSupplierProduct: vi.fn(),
  uploadProductImages: vi.fn(),
  reorderProductImages: vi.fn(),
  deleteProductImage: vi.fn(),
}))

const saved = (overrides = {}) => ({
  id: 5,
  type: 'product',
  title: 'Cartons ondulés sur mesure',
  description: 'Cartons simple ou double cannelure.',
  price: 2.4,
  unit: 'pièce',
  stock: 12500,
  availability_days: 5,
  status: 'draft',
  withdrawal_reason: null,
  category_id: 11,
  images: [],
  ...overrides,
})

let location
function Spy() {
  location = useLocation()
  return null
}

function renderAt(url) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        {['/fournisseur/produits/nouveau', '/fournisseur/produits/:productId/modifier'].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <>
                <ProductFormPage />
                <Spy />
              </>
            }
          />
        ))}
      </Routes>
    </MemoryRouter>,
  )
}

function fill(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview')
  globalThis.URL.revokeObjectURL = vi.fn()
  // Après une création, la page recharge le produit sur l'adresse de modification.
  api.fetchSupplierProduct.mockResolvedValue(saved())
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ProductFormPage', () => {
  it("crée un brouillon puis bascule sur l'adresse de modification", async () => {
    api.createSupplierProduct.mockResolvedValue({ product: saved() })
    api.updateSupplierProduct.mockResolvedValue({ message: 'Brouillon enregistré.', product: saved() })
    renderAt('/fournisseur/produits/nouveau')
    await screen.findByRole('option', { name: 'Cartons et caisses' })

    fill('Titre', 'Cartons ondulés sur mesure')
    fill('Catégorie', '11')
    fill('Prix (TND)', '2.4')
    fill('Stock', '12500')
    fill('Délai de disponibilité (jours)', '5')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }))

    await waitFor(() =>
      expect(api.createSupplierProduct).toHaveBeenCalledWith({
        type: 'product',
        title: 'Cartons ondulés sur mesure',
        category_id: 11,
        description: '',
        price: 2.4,
        unit: 'pièce',
        stock: 12500,
        availability_days: 5,
        status: 'draft',
      }),
    )
    await waitFor(() => expect(location.pathname).toBe('/fournisseur/produits/5/modifier'))
  })

  it('met à jour l’aperçu du catalogue en direct', async () => {
    renderAt('/fournisseur/produits/nouveau')
    await screen.findByText(/Atlas Emballages - Sfax/)

    fill('Titre', 'Palettes bois EPAL')
    fill('Prix (TND)', '18')
    fill('Unité', 'unité')

    const preview = screen.getByRole('heading', { name: 'Aperçu dans le catalogue' }).parentElement
    expect(within(preview).getByText('Palettes bois EPAL')).toBeTruthy()
    expect(within(preview).getByText('18 TND / unité')).toBeTruthy()
  })

  it('masque le stock pour un service', async () => {
    renderAt('/fournisseur/produits/nouveau')
    expect(screen.getByLabelText('Stock')).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: 'Service' }))
    expect(screen.queryByLabelText('Stock')).toBeNull()
  })

  it('publie : envoie les photos, puis demande le statut publié', async () => {
    api.createSupplierProduct.mockResolvedValue({ product: saved() })
    api.uploadProductImages.mockResolvedValue({ product: saved({ images: [{ id: 70, url: '/a.jpg', position: 1 }] }) })
    api.updateSupplierProduct.mockResolvedValue({
      message: 'Produit publié : il est visible dans le catalogue.',
      product: saved({ status: 'published', images: [{ id: 70, url: '/a.jpg', position: 1 }] }),
    })
    renderAt('/fournisseur/produits/nouveau')

    fill('Titre', 'Cartons')
    const file = new File(['x'], 'carton.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Choisir des images'), { target: { files: [file] } })
    expect(screen.getByText('Principale')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Publier' }))

    await waitFor(() => expect(api.uploadProductImages).toHaveBeenCalledWith(5, [file]))
    await waitFor(() =>
      expect(api.updateSupplierProduct).toHaveBeenCalledWith(5, expect.objectContaining({ status: 'published' })),
    )
    expect(api.createSupplierProduct).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }))
  })

  it('affiche les erreurs de l’API sous les champs', async () => {
    api.fetchSupplierProduct.mockResolvedValue(saved())
    api.updateSupplierProduct.mockRejectedValue(
      Object.assign(new Error('422'), {
        userMessage: 'Certaines informations sont invalides.',
        fieldErrors: { images: ['Ajoutez au moins une photo avant de publier.'], 'images.0': ['ignoré'] },
      }),
    )
    renderAt('/fournisseur/produits/5/modifier')
    await screen.findByDisplayValue('Cartons ondulés sur mesure')

    fireEvent.click(screen.getByRole('button', { name: 'Publier' }))

    expect(await screen.findByText('Ajoutez au moins une photo avant de publier.')).toBeTruthy()
  })

  it('réordonne les photos et supprime une photo existante à l’enregistrement', async () => {
    const images = [
      { id: 1, url: '/1.jpg', position: 1 },
      { id: 2, url: '/2.jpg', position: 2 },
      { id: 3, url: '/3.jpg', position: 3 },
    ]
    api.fetchSupplierProduct.mockResolvedValue(saved({ images }))
    api.deleteProductImage.mockResolvedValue({ product: saved({ images: [images[0], images[2]] }) })
    api.reorderProductImages.mockResolvedValue({ product: saved({ images: [images[2], images[0]] }) })
    api.updateSupplierProduct.mockResolvedValue({ message: 'Brouillon enregistré.', product: saved({ images: [images[2], images[0]] }) })
    renderAt('/fournisseur/produits/5/modifier')
    await screen.findByAltText('Photo 3')

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la photo 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Déplacer la photo 2 vers la gauche' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }))

    await waitFor(() => expect(api.deleteProductImage).toHaveBeenCalledWith(5, 2))
    await waitFor(() => expect(api.reorderProductImages).toHaveBeenCalledWith(5, [3, 1]))
    expect(await screen.findByText('Brouillon enregistré.')).toBeTruthy()
  })

  it('un produit retiré affiche le motif et ne peut pas être publié', async () => {
    api.fetchSupplierProduct.mockResolvedValue(saved({ status: 'withdrawn', withdrawal_reason: 'Photos trompeuses' }))
    renderAt('/fournisseur/produits/5/modifier')

    expect(await screen.findByText('Motif : Photos trompeuses')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Publier' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Enregistrer les modifications' })).toBeTruthy()
  })

  it('les boutons IA sont présents mais désactivés', async () => {
    renderAt('/fournisseur/produits/nouveau')
    expect(screen.getByRole('button', { name: '✦ Rédiger avec l’IA' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: '✦ Reformuler' }).disabled).toBe(true)
  })
})

describe('contrôle des fichiers image', () => {
  const file = (name, type, size = 1000) => {
    const f = new File(['x'], name, { type })
    Object.defineProperty(f, 'size', { value: size })
    return f
  }

  it('refuse les mauvais formats, les fichiers trop lourds et au-delà de 4 photos', () => {
    const { accepted, errors } = checkFiles(
      [file('a.jpg', 'image/jpeg'), file('b.gif', 'image/gif'), file('c.png', 'image/png', 4 * 1024 * 1024), file('d.webp', 'image/webp')],
      2,
    )
    expect(accepted.map((f) => f.name)).toEqual(['a.jpg', 'd.webp'])
    expect(errors).toHaveLength(2)

    expect(checkFiles([file('e.jpg', 'image/jpeg')], 4).accepted).toHaveLength(0)
  })
})
