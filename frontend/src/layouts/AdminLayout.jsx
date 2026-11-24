import { selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import SpaceLayout from './SpaceLayout'

/**
 * Mise en page du back-office administrateur (maquettes AD1 à AD8).
 * Les entrées des fonctionnalités à venir sont affichées mais inactives (« Bientôt disponible »).
 */
const NAV_ITEMS = [
  { label: 'Tableau de bord', to: PATHS.admin, end: true }, // SCRUM-122
  { label: 'Validation fournisseurs', to: PATHS.adminSuppliers }, // SCRUM-31 / SCRUM-99
  { label: 'Gestion des catégories', to: PATHS.adminCategories }, // SCRUM-32
  { label: 'Contrôle du catalogue', to: PATHS.adminProducts }, // F29 / SCRUM-123
  { label: 'Avis signalés', to: PATHS.adminReviews }, // F29 / SCRUM-123
  { label: 'Litiges', to: PATHS.adminDisputes }, // F23 / S5
  { label: 'Gestion des utilisateurs', to: PATHS.adminUsers }, // SCRUM-71
  { label: 'Paramètres du compte', to: PATHS.account },
]

export default function AdminLayout() {
  const user = useAuthStore(selectUser)

  return (
    <SpaceLayout
      title="Administration"
      homePath={PATHS.admin}
      navItems={NAV_ITEMS}
      displayName={user?.name ?? 'Administrateur'}
    />
  )
}
