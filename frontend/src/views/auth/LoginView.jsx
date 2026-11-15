import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import { PATHS, safeRedirect } from '@/router/paths'
import { landingPathFor } from '@/utils/roles'

/**
 * Connexion (SCRUM-25) : redirection vers l'espace du rôle, message générique en cas d'erreur,
 * message explicite pour un compte suspendu ou désactivé, « Se souvenir de moi ».
 */
export default function LoginView() {
  const login = useAuthStore((state) => state.login)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Message laissé par une autre page (ex. « mot de passe modifié », SCRUM-26).
  const notice = location.state?.notice ?? null

  const [form, setForm] = useState({ email: location.state?.email ?? '', password: '', remember: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null) // { text, blocked }
  const [fieldErrors, setFieldErrors] = useState({})

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setFieldErrors({})
    try {
      const user = await login(form.email.trim(), form.password, form.remember)
      navigate(safeRedirect(searchParams.get('redirect')) ?? landingPathFor(user), { replace: true })
    } catch (e) {
      const reason = e.response?.data?.reason
      const errors = e.fieldErrors ?? {}
      // Identifiants incorrects : un seul message général, sans pointer un champ en particulier.
      const credentialsError = errors.email?.[0] === 'Adresse e-mail ou mot de passe incorrect.'
      setError({
        text: credentialsError ? errors.email[0] : (e.userMessage ?? 'Connexion impossible.'),
        blocked: reason === 'suspended' || reason === 'deactivated',
      })
      setFieldErrors(credentialsError ? {} : errors)
      setLoading(false)
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <Link to={PATHS.home} className="text-sm text-brand-600">
          ← Accueil
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Connexion</h1>
        <p className="mt-1 text-sm text-slate-500">
          Accédez à votre espace fournisseur, porteur de projet ou administrateur.
        </p>

        {notice && (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
            {notice}
          </p>
        )}

        <form className="mt-6 space-y-4" noValidate onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Adresse e-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input"
              required
              value={form.email}
              onChange={update('email')}
            />
            {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email[0]}</p>}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium">
                Mot de passe
              </label>
              <Link to={PATHS.forgotPassword} className="text-sm text-brand-600 hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="input"
              required
              value={form.password}
              onChange={update('password')}
            />
            {fieldErrors.password && <p className="mt-1 text-sm text-red-600">{fieldErrors.password[0]}</p>}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-brand-600"
              checked={form.remember}
              onChange={update('remember')}
            />
            Se souvenir de moi
          </label>

          {error && !hasFieldErrors && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${error.blocked ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}
              role="alert"
            >
              {error.text}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Pas encore de compte ?{' '}
          <Link to={PATHS.registerChoice} className="font-medium text-brand-600 hover:underline">
            Inscrire mon entreprise
          </Link>
        </p>
      </div>
    </div>
  )
}
