import { selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import SpaceLayout from './SpaceLayout'

/**
 * Mise en page « Administration » (maquettes AD1 à AD8).
 * Le tableau de bord actuel de l'administrateur est la file de validation des fournisseurs (SCRUM-31).
 */
const NAV_ITEMS = [
  { label: 'Tableau de bord' }, // SCRUM-75
  { label: 'Gestion des utilisateurs' }, // SCRUM-74
  { label: 'Validation des fournisseurs', to: PATHS.admin, end: true },
  { label: 'Contrôle du catalogue' }, // SCRUM-73
  { label: 'Gestion des catégories', to: PATHS.adminCategories },
  { label: 'Gestion des litiges' }, // SCRUM-69
  { label: 'Avis signalés' }, // SCRUM-66
  { label: 'Statistiques et export' }, // SCRUM-77
]

export default function AdminLayout() {
  const user = useAuthStore(selectUser)

  return (
    <SpaceLayout
      title="Administration"
      homePath={PATHS.admin}
      navItems={NAV_ITEMS}
      displayName={user?.name}
    />
  )
}
