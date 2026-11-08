import { selectUser, useAuthStore } from '@/stores/auth'

export default function AdminDashboard() {
  const user = useAuthStore(selectUser)

  return (
    <>
      <h1 className="text-2xl font-semibold">Bonjour {user?.name}</h1>
      <p className="mt-1 text-slate-500">Back-office administrateur</p>

      {/* Validation des fournisseurs en S1 (SCRUM-31), indicateurs en S6 (SCRUM-70) */}
      <div className="card mt-6 text-slate-600">
        Le back-office est prêt. La validation des fournisseurs arrive au sprint S1.
      </div>
    </>
  )
}
