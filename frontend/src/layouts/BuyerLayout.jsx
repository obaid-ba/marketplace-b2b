import { selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import SpaceLayout from './SpaceLayout'

/**
 * Mise en page « Espace porteur de projet » (maquettes B1 à B8).
 * Les entrées sans adresse arrivent dans les prochains sprints : elles sont affichées, mais inactives.
 */
const NAV_ITEMS = [
  { label: 'Tableau de bord', to: PATHS.buyer, end: true },
  { label: 'Publier une demande' }, // SCRUM-41
  { label: 'Mes demandes' }, // SCRUM-43
  { label: 'Mes commandes' }, // SCRUM-56
  { label: 'Fournisseurs favoris', to: PATHS.buyerFavorites }, // SCRUM-39
  { label: 'Messagerie' }, // SCRUM-59
  { label: 'Notifications' }, // SCRUM-62
  { label: 'Paramètres du compte', to: PATHS.account }, // SCRUM-29
]

export default function BuyerLayout() {
  const user = useAuthStore(selectUser)

  return <SpaceLayout title="Espace porteur de projet" homePath={PATHS.buyer} navItems={NAV_ITEMS} displayName={user?.name} />
}
