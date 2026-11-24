import { selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import SpaceLayout from './SpaceLayout'

/**
 * Mise en page « Espace porteur de projet » (maquettes B1 à B8).
 * Les entrées sans adresse arrivent dans les prochains sprints : elles sont affichées, mais inactives.
 */
const NAV_ITEMS = [
  { label: 'Tableau de bord', to: PATHS.buyer, end: true },
  { label: 'Mes demandes', to: PATHS.buyerTenders }, // SCRUM-43
  { label: 'Publier une demande', to: PATHS.buyerTenderNew }, // SCRUM-41
  { label: 'Mes commandes', to: PATHS.buyerOrders }, // SCRUM-48
  { label: 'Fournisseurs favoris', to: PATHS.buyerFavorites }, // SCRUM-39
  { label: 'Mes litiges', to: PATHS.buyerDisputes }, // SCRUM-67
  { label: 'Assistant IA', to: PATHS.buyerAi }, // SCRUM-124 / SCRUM-79
  { label: 'Messagerie', to: PATHS.buyerMessages, badge: 'messages' }, // SCRUM-59
  { label: 'Notifications', to: PATHS.buyerNotifications }, // SCRUM-62
  { label: 'Préférences de notification', to: PATHS.notificationPreferences }, // SCRUM-63
  { label: 'Paramètres du compte', to: PATHS.account }, // SCRUM-29
]

export default function BuyerLayout() {
  const user = useAuthStore(selectUser)

  return (
    <SpaceLayout
      title="Espace porteur de projet"
      homePath={PATHS.buyer}
      navItems={NAV_ITEMS}
      displayName={user?.buyer_organization || user?.name}
      notificationsPath={PATHS.buyerNotifications}
    />
  )
}
