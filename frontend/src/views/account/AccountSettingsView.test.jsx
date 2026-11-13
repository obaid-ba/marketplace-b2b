import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { updateEmail, updatePassword, updateProfile } from '@/api/account'
import { useAuthStore } from '@/stores/auth'
import AccountSettingsView from './AccountSettingsView'

vi.mock('@/api/account', () => ({
  updateProfile: vi.fn(),
  updateEmail: vi.fn(),
  updatePassword: vi.fn(),
}))

const buyer = {
  id: 1,
  name: 'Karim Ben Salah',
  first_name: 'Karim',
  last_name: 'Ben Salah',
  email: 'karim@exemple.tn',
  email_verified: true,
  phone: '+216 71000000',
  role: 'buyer',
  buyer_profile: {
    organization: 'Société Karim & Fils',
    sector: 'Bâtiment',
  },
}

function renderView() {
  render(
    <MemoryRouter>
      <AccountSettingsView />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ user: buyer, token: 'test-token', loaded: true })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AccountSettingsView (SCRUM-27)', () => {
  it('affiche les informations du compte et les trois formulaires', () => {
    renderView()

    expect(screen.getByRole('heading', { name: 'Paramètres du compte' })).toBeTruthy()
    expect(screen.getByLabelText('Prénom').value).toBe('Karim')
    expect(screen.getByLabelText('Nom').value).toBe('Ben Salah')
    expect(screen.getByLabelText('Téléphone').value).toBe('71000000')
    expect(screen.getByLabelText('Organisation ou projet représenté').value).toBe('Société Karim & Fils')
    expect(screen.getByLabelText("Secteur d'activité").value).toBe('Bâtiment')
    expect(screen.getByText('karim@exemple.tn')).toBeTruthy()
    expect(screen.getByLabelText('Mot de passe actuel')).toBeTruthy()
    expect(screen.getByLabelText('Nouveau mot de passe')).toBeTruthy()
    expect(screen.getByLabelText('Confirmer le nouveau mot de passe')).toBeTruthy()
  })

  it('enregistre le nom, le téléphone, l’organisation et le secteur', async () => {
    vi.mocked(updateProfile).mockResolvedValue({
      message: 'Vos informations ont été mises à jour.',
      user: {
        ...buyer,
        name: 'Salma Trabelsi',
        first_name: 'Salma',
        last_name: 'Trabelsi',
        phone: '+216 98123456',
        buyer_profile: { organization: 'Nouvelle organisation', sector: 'Informatique' },
      },
    })

    renderView()
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Salma' } })
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Trabelsi' } })
    fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '98123456' } })
    fireEvent.change(screen.getByLabelText('Organisation ou projet représenté'), {
      target: { value: 'Nouvelle organisation' },
    })
    fireEvent.change(screen.getByLabelText("Secteur d'activité"), { target: { value: 'Informatique' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }))

    expect(await screen.findByText('Vos informations ont été mises à jour.')).toBeTruthy()
    expect(updateProfile).toHaveBeenCalledWith({
      first_name: 'Salma',
      last_name: 'Trabelsi',
      phone: '+216 98123456',
      organization: 'Nouvelle organisation',
      sector: 'Informatique',
    })
    expect(useAuthStore.getState().user.name).toBe('Salma Trabelsi')
  })

  it('valide les champs du profil avant d’appeler l’API', async () => {
    renderView()
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }))

    expect(await screen.findByText('Le prénom est obligatoire.')).toBeTruthy()
    expect(screen.getByText('Le téléphone doit contenir 8 chiffres (préfixe +216).')).toBeTruthy()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('change l’adresse e-mail et demande une nouvelle vérification', async () => {
    vi.mocked(updateEmail).mockResolvedValue({
      message: 'Un lien de vérification a été envoyé à nouvelle@exemple.tn.',
      user: { ...buyer, email: 'nouvelle@exemple.tn', email_verified: false },
    })

    renderView()
    fireEvent.change(screen.getByLabelText('Nouvelle adresse e-mail'), {
      target: { value: 'nouvelle@exemple.tn' },
    })
    fireEvent.click(screen.getByRole('button', { name: "Changer mon adresse e-mail" }))

    expect(
      await screen.findByText('Un lien de vérification a été envoyé à nouvelle@exemple.tn.'),
    ).toBeTruthy()
    expect(updateEmail).toHaveBeenCalledWith('nouvelle@exemple.tn')
    expect(useAuthStore.getState().user.email).toBe('nouvelle@exemple.tn')
    expect(useAuthStore.getState().user.email_verified).toBe(false)
    expect(
      screen.getByText(/Votre adresse e-mail n'est pas encore vérifiée/),
    ).toBeTruthy()
  })

  it('refuse une adresse e-mail invalide sans appeler l’API', async () => {
    renderView()
    fireEvent.change(screen.getByLabelText('Nouvelle adresse e-mail'), {
      target: { value: 'pas-une-adresse' },
    })
    fireEvent.click(screen.getByRole('button', { name: "Changer mon adresse e-mail" }))

    expect(await screen.findByText('Saisissez une adresse e-mail valide.')).toBeTruthy()
    expect(updateEmail).not.toHaveBeenCalled()
  })

  it('change le mot de passe après saisie de l’ancien', async () => {
    vi.mocked(updatePassword).mockResolvedValue({
      message: 'Votre mot de passe a été modifié. Les autres sessions ont été déconnectées.',
    })

    renderView()
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), {
      target: { value: 'Password123' },
    })
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
      target: { value: 'NouveauPass456' },
    })
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), {
      target: { value: 'NouveauPass456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Modifier mon mot de passe' }))

    expect(
      await screen.findByText('Votre mot de passe a été modifié. Les autres sessions ont été déconnectées.'),
    ).toBeTruthy()
    expect(updatePassword).toHaveBeenCalledWith({
      current_password: 'Password123',
      password: 'NouveauPass456',
      password_confirmation: 'NouveauPass456',
    })
  })

  it('refuse deux mots de passe différents et un mot de passe trop faible', async () => {
    renderView()
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), {
      target: { value: 'Password123' },
    })
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
      target: { value: 'faible' },
    })
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), {
      target: { value: 'AutrePass456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Modifier mon mot de passe' }))

    expect(await screen.findByText(/Mot de passe trop faible/)).toBeTruthy()
    expect(screen.getByText('Les deux mots de passe ne correspondent pas.')).toBeTruthy()
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('affiche l’erreur du serveur quand l’ancien mot de passe est incorrect', async () => {
    vi.mocked(updatePassword).mockRejectedValueOnce(
      Object.assign(new Error('Certains champs sont invalides.'), {
        userMessage: 'Certains champs sont invalides.',
        fieldErrors: { current_password: ['Le mot de passe actuel est incorrect.'] },
      }),
    )

    renderView()
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), {
      target: { value: 'MauvaisPass123' },
    })
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
      target: { value: 'NouveauPass456' },
    })
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), {
      target: { value: 'NouveauPass456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Modifier mon mot de passe' }))

    expect(await screen.findByText('Le mot de passe actuel est incorrect.')).toBeTruthy()
    expect(screen.getByText('Certains champs sont invalides.')).toBeTruthy()
  })
})
