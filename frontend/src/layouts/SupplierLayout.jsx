import { selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import SpaceLayout from './SpaceLayout'

/**
 * Mise en page « Espace fournisseur » (maquette Figma) : barre latérale et en-tête communs (SpaceLayout).
 */
const NAV_ITEMS = [
  { label: 'Tableau de bord', to: PATHS.supplier, end: true },
  { label: 'Mes produits', to: PATHS.supplierProducts }, // SCRUM-34
  { label: 'Demandes reçues', to: PATHS.supplierTenders }, // SCRUM-44
  { label: 'Mes devis', to: PATHS.supplierQuotes }, // SCRUM-46
  { label: 'Mes commandes', to: PATHS.supplierOrders }, // SCRUM-58
  { label: 'Mes avis', to: PATHS.supplierReviews }, // SCRUM-65
  { label: 'Litiges reçus', to: PATHS.supplierDisputes }, // SCRUM-67
  { label: 'Assistant IA', to: PATHS.supplierAi }, // SCRUM-77 / SCRUM-78
  { label: 'Messagerie', to: PATHS.supplierMessages, badge: 'messages' }, // SCRUM-59
  { label: 'Notifications', to: PATHS.supplierNotifications }, // SCRUM-62
  { label: 'Préférences de notification', to: PATHS.notificationPreferences }, // SCRUM-63
  { label: "Profil de l'entreprise", to: PATHS.supplierProfile },
  { label: 'Paramètres du compte', to: PATHS.account }, // SCRUM-29
]

export default function SupplierLayout() {
  const user = useAuthStore(selectUser)

  return (
    <SpaceLayout
      title="Espace fournisseur"
      homePath={PATHS.supplier}
      navItems={NAV_ITEMS}
      displayName={user?.supplier_company_name || user?.name}
      notificationsPath={PATHS.supplierNotifications}
    />
  )
}
