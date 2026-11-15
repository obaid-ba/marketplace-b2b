import { useNavigate } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'

/** Bouton « Déconnexion », présent sur toutes les pages d'un utilisateur connecté (SCRUM-25). */
export default function LogoutButton({ className = 'btn-ghost' }) {
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate(PATHS.login)
  }

  return (
    <button type="button" className={className} onClick={handleLogout}>
      Déconnexion
    </button>
  )
}
