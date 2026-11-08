import { selectUser, useAuthStore } from '@/stores/auth'

export default function SupplierDashboard() {
  const user = useAuthStore(selectUser)

  return (
    <>
      <h1 className="text-2xl font-semibold">Bonjour {user?.name}</h1>
      <p className="mt-1 text-slate-500">Tableau de bord fournisseur</p>

      {/* Indicateurs complets en S6 (SCRUM-68) */}
      <div className="card mt-6 text-slate-600">
        Votre espace fournisseur est prêt. Produits, demandes reçues et devis arrivent dans les prochains sprints.
      </div>
    </>
  )
}
