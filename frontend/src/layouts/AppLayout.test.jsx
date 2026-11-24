import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from './AppLayout'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))

afterEach(cleanup)

function show(role) {
  useAuthStore.setState({ user: { id: 1, name: 'Sana', role, email_verified: true }, token: 't', loaded: true })
  render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  )
}

describe('AppLayout : menu sur téléphone', () => {
  it('ouvre le menu du compte et le referme après un choix', () => {
    show('buyer')
    const button = screen.getByRole('button', { name: 'Ouvrir le menu' })
    expect(button.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(button)
    const menu = screen.getByRole('navigation', { name: 'Menu du compte' })
    expect(within(menu).getByText('Sana')).toBeTruthy()
    expect(within(menu).getByRole('button', { name: 'Déconnexion' })).toBeTruthy()
    fireEvent.click(within(menu).getByRole('link', { name: 'Mes commandes' }))
    expect(screen.queryByRole('navigation', { name: 'Menu du compte' })).toBeNull()
  })

  it('propose à l’administrateur ses pages', () => {
    show('admin')
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }))
    const menu = screen.getByRole('navigation', { name: 'Menu du compte' })
    expect(within(menu).getByRole('link', { name: 'Fournisseurs' }).getAttribute('href')).toBe('/admin/fournisseurs')
    expect(within(menu).queryByRole('link', { name: 'Mes commandes' })).toBeNull()
  })
})
