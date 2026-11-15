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

const regions = [
  { id: 1, name: 'Tunis' },
  { id: 2, name: 'Sfax' },
]

function renderView() {
  render(
    <MemoryRouter>
      <RegisterBuyerView />
    </MemoryRouter>,
  )
}

async function fillForm(overrides = {}) {
  const values = {
    Prénom: 'Karim',
    Nom: 'Ben Salah',
    'Adresse e-mail': 'karim@exemple.tn',
    Téléphone: '71000000',
    'Mot de passe': 'Password123',
    'Confirmation du mot de passe': 'Password123',
    'Type de porteur': 'entreprise',
    'Organisation ou projet représenté': 'Société Karim & Fils',
    "Secteur d'activité": 'Bâtiment',
    ...overrides,
  }

  Object.entries(values).forEach(([label, value]) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  })

  fireEvent.change(screen.getByLabelText('Région'), { target: { value: '1' } })
  fireEvent.click(screen.getByLabelText(/J'accepte les conditions/))
}

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null, loaded: true })
  http.get.mockResolvedValue({ data: regions })
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
  it('affiche les champs du compte et du profil acheteur', async () => {
    renderView()

    expect(screen.getByRole('heading', { name: 'Inscription porteur de projet' })).toBeTruthy()

    const labels = [
      'Prénom',
      'Nom',
      'Adresse e-mail',
      'Téléphone',
      'Mot de passe',
      'Confirmation du mot de passe',
      'Type de porteur',
      'Région',
      'Organisation ou projet représenté',
      "Secteur d'activité",
    ]
    labels.forEach((label) => expect(screen.getByLabelText(label)).toBeTruthy())
    expect(await screen.findByRole('option', { name: 'Tunis' })).toBeTruthy()
  })

  it('affiche les erreurs champ par champ sans appeler l’API', async () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText('Le prénom est obligatoire.')).toBeTruthy()
    expect(screen.getByText('Le nom est obligatoire.')).toBeTruthy()
    expect(screen.getByText('Saisissez une adresse e-mail valide.')).toBeTruthy()
    expect(screen.getByText('Le téléphone doit contenir 8 chiffres (préfixe +216).')).toBeTruthy()
    expect(screen.getByText(/Mot de passe trop faible/)).toBeTruthy()
    expect(screen.getByText('Le type de porteur est obligatoire.')).toBeTruthy()
    expect(screen.getByText("L'organisation ou le projet représenté est obligatoire.")).toBeTruthy()
    expect(screen.getByText("Le secteur d'activité est obligatoire.")).toBeTruthy()
    expect(screen.getByText('La région est obligatoire.')).toBeTruthy()
    expect(screen.getByText("Vous devez accepter les conditions d'utilisation.")).toBeTruthy()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('refuse deux mots de passe différents', async () => {
    renderView()
    await screen.findByRole('option', { name: 'Tunis' })
    await fillForm({ 'Confirmation du mot de passe': 'Autre1234' })
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText('Les deux mots de passe ne correspondent pas.')).toBeTruthy()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('envoie le compte et le profil puis affiche la confirmation', async () => {
    renderView()
    await screen.findByRole('option', { name: 'Tunis' })
    await fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByRole('heading', { name: 'Vérifiez votre boîte e-mail' })).toBeTruthy()

    expect(http.post).toHaveBeenCalledTimes(1)
    expect(http.post).toHaveBeenCalledWith('/auth/register/buyer', {
      first_name: 'Karim',
      last_name: 'Ben Salah',
      email: 'karim@exemple.tn',
      phone: '+216 71000000',
      password: 'Password123',
      password_confirmation: 'Password123',
      buyer_type: 'entreprise',
      organization: 'Société Karim & Fils',
      sector: 'Bâtiment',
      region_id: 1,
      terms_accepted: true,
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
    await screen.findByRole('option', { name: 'Tunis' })
    await fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText("L'adresse e-mail n'est pas valide.")).toBeTruthy()
    expect(screen.getByText('Certains champs sont invalides.')).toBeTruthy()
  })
})
