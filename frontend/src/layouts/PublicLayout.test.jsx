import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import PublicLayout from './PublicLayout'

vi.mock('@/api/http', () => ({ http: { get: vi.fn().mockResolvedValue({ data: { count: 0 } }), post: vi.fn() }, onAuthError: vi.fn() }))

afterEach(cleanup)

function show(user) {
  useAuthStore.setState({ user, token: user ? 't' : null, loaded: true })
  render(
    <MemoryRouter>
      <PublicLayout />
    </MemoryRouter>,
  )
}

describe('PublicLayout : cloche de notifications (SCRUM-62)', () => {
  it('est affichée à un utilisateur connecté', () => {
    show({ id: 1, name: 'Sana', role: 'buyer', email_verified: true })
    expect(screen.getByRole('button', { name: /^Notifications/ })).toBeTruthy()
  })

  it('n’est pas affichée à un visiteur', () => {
    show(null)
    expect(screen.queryByRole('button', { name: /^Notifications/ })).toBeNull()
    expect(screen.getAllByRole('link', { name: 'Connexion' }).length).toBeGreaterThan(0)
  })
})
