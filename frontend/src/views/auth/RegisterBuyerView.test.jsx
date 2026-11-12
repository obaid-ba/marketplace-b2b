import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import RegisterBuyerView from './RegisterBuyerView'

vi.mock('@/api/http', () => ({
  http: { get: vi.fn(), post: vi.fn() },
  onAuthError: vi.fn(),
}))

function renderView() {
  render(
    <MemoryRouter>
      <RegisterBuyerView />
    </MemoryRouter>,
  )
}

function fillForm(overrides = {}) {
  const values = {
    Nom: 'Karim Ben Salah',
    'Adresse e-mail': 'karim@exemple.tn',
    'Mot de passe': 'Password123',
    'Confirmation du mot de passe': 'Password123',
    'Organisation ou projet représenté': 'Société Karim & Fils',
    "Secteur d'activité": 'Bâtiment',
    ...overrides,
  }

  Object.entries(values).forEach(([label, value]) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  })
}

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null, loaded: true })
  http.post.mockResolvedValue({
    data: {
      message: 'Votre compte a été créé.',
      user: { id: 2, name: 'Karim Ben Salah', email: 'karim@exemple.tn', role: 'buyer' },
    },
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('RegisterBuyerView', () => {
  it('affiche les champs du compte et du profil acheteur', () => {
    renderView()

    expect(screen.getByRole('heading', { name: 'Inscription porteur de projet' })).toBeTruthy()

    const labels = [
      'Nom',
      'Adresse e-mail',
      'Mot de passe',
      'Confirmation du mot de passe',
      'Organisation ou projet représenté',
      "Secteur d'activité",
    ]
    labels.forEach((label) => expect(screen.getByLabelText(label)).toBeTruthy())
  })

  it('affiche les erreurs champ par champ sans appeler l’API', async () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText('Le nom est obligatoire.')).toBeTruthy()
    expect(screen.getByText('Saisissez une adresse e-mail valide.')).toBeTruthy()
    expect(screen.getByText(/Mot de passe trop faible/)).toBeTruthy()
    expect(screen.getByText("L'organisation ou le projet représenté est obligatoire.")).toBeTruthy()
    expect(screen.getByText("Le secteur d'activité est obligatoire.")).toBeTruthy()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('refuse deux mots de passe différents', async () => {
    renderView()
    fillForm({ 'Confirmation du mot de passe': 'Autre1234' })
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText('Les deux mots de passe ne correspondent pas.')).toBeTruthy()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('envoie le compte et le profil puis affiche la confirmation', async () => {
    renderView()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByRole('heading', { name: 'Vérifiez votre boîte e-mail' })).toBeTruthy()

    expect(http.post).toHaveBeenCalledTimes(1)
    expect(http.post).toHaveBeenCalledWith('/auth/register/buyer', {
      name: 'Karim Ben Salah',
      email: 'karim@exemple.tn',
      password: 'Password123',
      password_confirmation: 'Password123',
      organization: 'Société Karim & Fils',
      sector: 'Bâtiment',
    })
    expect(screen.getByText('karim@exemple.tn')).toBeTruthy()
  })

  it('affiche les erreurs renvoyées par le serveur', async () => {
    http.post.mockRejectedValueOnce(
      Object.assign(new Error('Certains champs sont invalides.'), {
        userMessage: 'Certains champs sont invalides.',
        fieldErrors: { email: ["L'adresse e-mail n'est pas valide."] },
      }),
    )

    renderView()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText("L'adresse e-mail n'est pas valide.")).toBeTruthy()
    expect(screen.getByText('Certains champs sont invalides.')).toBeTruthy()
  })
})
