import { selectUser, useAuthStore } from '@/stores/auth'

export default function BuyerDashboard() {
  const user = useAuthStore(selectUser)

  return (
    <>
      <h1 className="text-2xl font-semibold">Bonjour {user?.name}</h1>
      <p className="mt-1 text-slate-500">Tableau de bord porteur de projet</p>

      {/* Indicateurs complets en S6 (SCRUM-69) */}
      <div className="card mt-6 text-slate-600">
        Votre espace est prêt. Demandes, comparaison des devis et commandes arrivent dans les prochains sprints.
      </div>
    </>
  )
}
