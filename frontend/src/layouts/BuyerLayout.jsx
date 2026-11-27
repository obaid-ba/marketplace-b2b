import { selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import SpaceLayout from './SpaceLayout'

/**
 * Mise en page « Espace porteur de projet » (maquettes B1 à B8).
 * Les entrées sans adresse arrivent dans les prochains sprints : elles sont affichées, mais inactives.
 */
const NAV_ITEMS = [
  { group: 'Achats', label: 'Tableau de bord', to: PATHS.buyer, end: true, icon: 'home' },
  { group: 'Achats', label: 'Mes demandes', to: PATHS.buyerTenders, icon: 'file' }, // SCRUM-43
  { group: 'Achats', label: 'Publier une demande', to: PATHS.buyerTenderNew, icon: 'plus' }, // SCRUM-41
  { group: 'Achats', label: 'Mes commandes', to: PATHS.buyerOrders, icon: 'cart' }, // SCRUM-48
  { group: 'Achats', label: 'Fournisseurs favoris', to: PATHS.buyerFavorites, icon: 'heart' }, // SCRUM-39
  { group: 'Achats', label: 'Mes litiges', to: PATHS.buyerDisputes, icon: 'alert' }, // SCRUM-67
  { group: 'Communication', label: 'Assistant IA', to: PATHS.buyerAi, icon: 'sparkles' }, // SCRUM-124 / SCRUM-79
  { group: 'Communication', label: 'Messagerie', to: PATHS.buyerMessages, badge: 'messages', icon: 'message' }, // SCRUM-59
  { group: 'Communication', label: 'Notifications', to: PATHS.buyerNotifications, icon: 'bell' }, // SCRUM-62
  // Préférences de notification (SCRUM-63) : accessibles depuis les paramètres.
  { group: 'Compte', label: 'Paramètres', to: PATHS.account, icon: 'settings' }, // SCRUM-29
]

export default function BuyerLayout() {
  const user = useAuthStore(selectUser)

  return (
    <SpaceLayout
      title="Espace porteur de projet"
      homePath={PATHS.buyer}
      navItems={NAV_ITEMS}
      displayName={user?.buyer_organization || user?.name}
      helpPath={PATHS.buyerAi}
      notificationsPath={PATHS.buyerNotifications}
    />
  )
}
