import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { deactivateAccount, deleteAccount } from '@/api/account'
import { useAuthStore } from '@/stores/auth'
import AccountSettingsView from './AccountSettingsView'

vi.mock('@/api/account', () => ({
  deactivateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}))

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

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 1, name: 'Karim', role: 'buyer', email_verified: true },
    token: 'test-token',
    loaded: true,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, token: null, loaded: true })
})

describe('AccountSettingsView (SCRUM-30)', () => {
  it('propose de désactiver ou de supprimer le compte', () => {
    renderView()

    expect(screen.getByRole('heading', { name: 'Paramètres du compte' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Désactiver mon compte' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Supprimer mon compte' })).toBeTruthy()
    expect(screen.getByText(/commandes, factures et avis sont conservés/i)).toBeTruthy()
  })

  it('exige la saisie du mot de passe avant de désactiver', async () => {
    renderView()

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver mon compte' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la désactivation' }))

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Saisissez votre mot de passe pour confirmer.',
    )
    expect(deactivateAccount).not.toHaveBeenCalled()
  })

  it('désactive le compte, déconnecte et affiche le message sur la page de connexion', async () => {
    deactivateAccount.mockResolvedValue({
      message: 'Votre compte a été désactivé. Vous êtes déconnecté de tous vos appareils.',
    })

    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver mon compte' }))
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la désactivation' }))

    expect(await screen.findByText(/Votre compte a été désactivé/)).toBeTruthy()
    expect(deactivateAccount).toHaveBeenCalledWith('secret123')
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('supprime le compte après confirmation par mot de passe', async () => {
    deleteAccount.mockResolvedValue({
      message: 'Votre compte a été supprimé. Vos commandes, factures et avis sont conservés.',
    })

    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }))
    expect(screen.getByRole('heading', { name: 'Confirmer la suppression' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    expect(await screen.findByText(/Votre compte a été supprimé/)).toBeTruthy()
    expect(deleteAccount).toHaveBeenCalledWith('secret123')
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('affiche l’erreur de l’API quand le mot de passe est incorrect', async () => {
    deactivateAccount.mockRejectedValue({
      fieldErrors: { password: ['Le mot de passe est incorrect.'] },
      userMessage: 'Certains champs sont invalides.',
    })

    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver mon compte' }))
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'mauvais' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la désactivation' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Le mot de passe est incorrect.')
    expect(useAuthStore.getState().user).not.toBeNull()
  })
})
