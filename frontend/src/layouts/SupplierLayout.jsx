import { selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import SpaceLayout from './SpaceLayout'

/**
 * Mise en page « Espace fournisseur » (maquette Figma) : barre latérale et en-tête communs (SpaceLayout).
 */
const NAV_ITEMS = [
  { group: 'Ventes', label: 'Tableau de bord', to: PATHS.supplier, end: true, icon: 'home' },
  { group: 'Ventes', label: 'Mes produits', to: PATHS.supplierProducts, icon: 'box' }, // SCRUM-34
  { group: 'Ventes', label: 'Demandes reçues', to: PATHS.supplierTenders, icon: 'inbox' }, // SCRUM-44
  { group: 'Ventes', label: 'Mes devis', to: PATHS.supplierQuotes, icon: 'receipt' }, // SCRUM-46
  { group: 'Ventes', label: 'Mes commandes', to: PATHS.supplierOrders, icon: 'cart' }, // SCRUM-58
  { group: 'Ventes', label: 'Mes avis', to: PATHS.supplierReviews, icon: 'star' }, // SCRUM-65
  { group: 'Ventes', label: 'Litiges reçus', to: PATHS.supplierDisputes, icon: 'alert' }, // SCRUM-67
  { group: 'Communication', label: 'Assistant IA', to: PATHS.supplierAi, icon: 'sparkles' }, // SCRUM-77 / SCRUM-78
  { group: 'Communication', label: 'Messagerie', to: PATHS.supplierMessages, badge: 'messages', icon: 'message' }, // SCRUM-59
  { group: 'Communication', label: 'Notifications', to: PATHS.supplierNotifications, icon: 'bell' }, // SCRUM-62
  // Préférences de notification (SCRUM-63) : accessibles depuis les paramètres.
  { group: 'Compte', label: "Profil de l'entreprise", to: PATHS.supplierProfile, icon: 'building' },
  { group: 'Compte', label: 'Paramètres', to: PATHS.account, icon: 'settings' }, // SCRUM-29
]

export default function SupplierLayout() {
  const user = useAuthStore(selectUser)

  return (
    <SpaceLayout
      title="Espace fournisseur"
      homePath={PATHS.supplier}
      navItems={NAV_ITEMS}
      displayName={user?.supplier_company_name || user?.name}
      helpPath={PATHS.supplierAi}
      notificationsPath={PATHS.supplierNotifications}
    />
  )
}
