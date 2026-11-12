/** Carte centrée utilisée par les pages d'authentification (connexion, vérification d'e-mail…). */
export default function AuthCard({ icon, title, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md">
        {icon && <div className="mb-4 text-4xl" aria-hidden="true">{icon}</div>}
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="mt-3 space-y-4 text-sm text-slate-600">{children}</div>
      </div>
    </div>
  )
}
