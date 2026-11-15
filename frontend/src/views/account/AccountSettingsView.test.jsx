import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import {
  deactivateAccount,
  deleteAccount,
  updateAccount,
  updatePassword,
} from '@/api/account'
import { useAuthStore } from '@/stores/auth'
import AccountSettingsView from './AccountSettingsView'

vi.mock('@/api/account', () => ({
  updateAccount: vi.fn(),
  updatePassword: vi.fn(),
  deactivateAccount: vi.fn(),
  deleteAccount: vi.fn(),
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

function LoginProbe() {
  const location = useLocation()
  return <div>{location.state?.notice ?? 'Page de connexion'}</div>
}

function renderView() {
  render(
    <MemoryRouter initialEntries={['/parametres']}>
      <Routes>
        <Route path="/parametres" element={<AccountSettingsView />} />
        <Route path="/connexion" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

function openTab(name) {
  fireEvent.click(screen.getByRole('tab', { name }))
}

beforeEach(() => {
  useAuthStore.setState({ user: buyer, token: 'test-token', loaded: true })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, token: null, loaded: true })
})

describe('AccountSettingsView (SCRUM-98)', () => {
  it('affiche les trois onglets et pré-remplit les informations du compte', () => {
    renderView()

    expect(screen.getByRole('heading', { name: 'Paramètres du compte' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Informations' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Mot de passe' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Supprimer le compte' })).toBeTruthy()

    expect(screen.getByLabelText('Prénom').value).toBe('Karim')
    expect(screen.getByLabelText('Nom').value).toBe('Ben Salah')
    expect(screen.getByLabelText('Adresse e-mail').value).toBe('karim@exemple.tn')
    expect(screen.getByLabelText('Téléphone').value).toBe('71000000')
    expect(screen.getByLabelText('Organisation ou projet représenté').value).toBe('Société Karim & Fils')
    expect(screen.getByLabelText("Secteur d'activité").value).toBe('Bâtiment')
  })

  it('enregistre les informations personnelles via PUT /account', async () => {
    vi.mocked(updateAccount).mockResolvedValue({
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
    expect(updateAccount).toHaveBeenCalledWith({
      first_name: 'Salma',
      last_name: 'Trabelsi',
      email: 'karim@exemple.tn',
      phone: '+216 98123456',
      organization: 'Nouvelle organisation',
      sector: 'Informatique',
    })
    expect(useAuthStore.getState().user.name).toBe('Salma Trabelsi')
  })

  it('avertit quand l’adresse e-mail change et applique la nouvelle vérification', async () => {
    vi.mocked(updateAccount).mockResolvedValue({
      message:
        'Vos informations ont été mises à jour. Un lien de vérification a été envoyé à nouvelle@exemple.tn.',
      user: { ...buyer, email: 'nouvelle@exemple.tn', email_verified: false },
    })

    renderView()
    fireEvent.change(screen.getByLabelText('Adresse e-mail'), {
      target: { value: 'nouvelle@exemple.tn' },
    })

    expect(screen.getByText(/Votre adresse va changer/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }))

    expect(await screen.findByText(/Un lien de vérification a été envoyé/)).toBeTruthy()
    expect(useAuthStore.getState().user.email).toBe('nouvelle@exemple.tn')
    expect(useAuthStore.getState().user.email_verified).toBe(false)
    expect(screen.getByText(/Votre adresse e-mail n'est pas encore vérifiée/)).toBeTruthy()
  })

  it('valide les champs du profil avant d’appeler l’API', async () => {
    renderView()
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Adresse e-mail'), { target: { value: 'pas-une-adresse' } })
    fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }))

    expect(await screen.findByText('Le prénom est obligatoire.')).toBeTruthy()
    expect(screen.getByText('Saisissez une adresse e-mail valide.')).toBeTruthy()
    expect(screen.getByText('Le téléphone doit contenir 8 chiffres (préfixe +216).')).toBeTruthy()
    expect(updateAccount).not.toHaveBeenCalled()
  })

  it('affiche les erreurs 422 renvoyées par l’API', async () => {
    vi.mocked(updateAccount).mockRejectedValueOnce(
      Object.assign(new Error('Certains champs sont invalides.'), {
        userMessage: 'Certains champs sont invalides.',
        fieldErrors: { email: ['Un compte existe déjà avec cette adresse e-mail.'] },
      }),
    )

    renderView()
    fireEvent.change(screen.getByLabelText('Adresse e-mail'), {
      target: { value: 'prise@exemple.tn' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }))

    expect(
      await screen.findByText('Un compte existe déjà avec cette adresse e-mail.'),
    ).toBeTruthy()
    expect(screen.getByText('Certains champs sont invalides.')).toBeTruthy()
  })

  it('change le mot de passe après saisie de l’ancien', async () => {
    vi.mocked(updatePassword).mockResolvedValue({
      message: 'Votre mot de passe a été modifié. Les autres sessions ont été déconnectées.',
    })

    renderView()
    openTab('Mot de passe')
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
    openTab('Mot de passe')
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
    openTab('Mot de passe')
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

  it('supprime le compte après confirmation par mot de passe et déconnecte l’utilisateur', async () => {
    vi.mocked(deleteAccount).mockResolvedValue({
      message: 'Votre compte a été supprimé. Vos commandes, factures et avis sont conservés.',
    })

    renderView()
    openTab('Supprimer le compte')
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    expect(await screen.findByText('Saisissez votre mot de passe pour confirmer.')).toBeTruthy()
    expect(deleteAccount).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    expect(await screen.findByText(/Votre compte a été supprimé/)).toBeTruthy()
    expect(deleteAccount).toHaveBeenCalledWith('secret123')
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('désactive le compte après confirmation par mot de passe', async () => {
    vi.mocked(deactivateAccount).mockResolvedValue({
      message: 'Votre compte a été désactivé. Vous êtes déconnecté de tous vos appareils.',
    })

    renderView()
    openTab('Supprimer le compte')
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver mon compte' }))
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la désactivation' }))

    expect(await screen.findByText(/Votre compte a été désactivé/)).toBeTruthy()
    expect(deactivateAccount).toHaveBeenCalledWith('secret123')
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('annule la confirmation sans appeler l’API', () => {
    renderView()
    openTab('Supprimer le compte')
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deleteAccount).not.toHaveBeenCalled()
  })
})
