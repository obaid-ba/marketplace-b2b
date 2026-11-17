import { selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import SpaceLayout from './SpaceLayout'

/**
 * Mise en page « Espace fournisseur » (maquette Figma).
 * Les entrées sans adresse arrivent dans les prochains sprints : elles sont affichées, mais inactives.
 */
const NAV_ITEMS = [
  { label: 'Tableau de bord', to: PATHS.supplier, end: true },
  { label: 'Mes produits', to: PATHS.supplierProducts }, // SCRUM-33 / SCRUM-34
  { label: 'Demandes reçues' }, // SCRUM-44
  { label: 'Mes devis' }, // SCRUM-46
  { label: 'Mes commandes' }, // SCRUM-58
  { label: 'Mes avis' }, // SCRUM-65
  { label: 'Messagerie' }, // SCRUM-59
  { label: 'Notifications' }, // SCRUM-62
  { label: "Profil de l'entreprise", to: PATHS.supplierProfile },
  { label: 'Paramètres du compte' }, // SCRUM-29
]

export default function SupplierLayout() {
  const user = useAuthStore(selectUser)

  return (
    <SpaceLayout
      title="Espace fournisseur"
      homePath={PATHS.supplier}
      navItems={NAV_ITEMS}
      displayName={user?.supplier_company_name || user?.name}
    />
  )
}
