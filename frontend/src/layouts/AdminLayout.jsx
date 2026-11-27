import { selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import SpaceLayout from './SpaceLayout'

/**
 * Mise en page du back-office administrateur (maquettes AD1 à AD8).
 * Les entrées des fonctionnalités à venir sont affichées mais inactives (« Bientôt disponible »).
 */
const NAV_ITEMS = [
  { group: 'Pilotage', label: 'Tableau de bord', to: PATHS.admin, end: true, icon: 'home' }, // SCRUM-122
  { group: 'Pilotage', label: 'Validation fournisseurs', to: PATHS.adminSuppliers, icon: 'check' }, // SCRUM-31 / SCRUM-99
  { group: 'Pilotage', label: 'Utilisateurs', to: PATHS.adminUsers, icon: 'users' }, // F24 / SCRUM-118
  { group: 'Pilotage', label: 'Gestion des catégories', to: PATHS.adminCategories, icon: 'tags' }, // SCRUM-32
  { group: 'Modération', label: 'Contrôle du catalogue', to: PATHS.adminProducts, icon: 'shield' }, // F29 / SCRUM-123
  { group: 'Modération', label: 'Avis signalés', to: PATHS.adminReviews, icon: 'flag' }, // F29 / SCRUM-123
  { group: 'Modération', label: 'Litiges', to: PATHS.adminDisputes, icon: 'alert' }, // F23 / SCRUM-117
  { group: 'Modération', label: "Journal d'audit", to: PATHS.adminAudit, icon: 'history' }, // SCRUM-76
  { group: 'Compte', label: 'Notifications', to: PATHS.adminNotifications, icon: 'bell' }, // SCRUM-62
  { group: 'Compte', label: 'Paramètres', to: PATHS.account, icon: 'settings' },
]

export default function AdminLayout() {
  const user = useAuthStore(selectUser)

  return (
    <SpaceLayout
      title="Administration"
      homePath={PATHS.admin}
      navItems={NAV_ITEMS}
      displayName={user?.name ?? 'Administrateur'}
      notificationsPath={PATHS.adminNotifications}
    />
  )
}
