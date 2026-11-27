import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import AuthLayout, { AuthCard, BackHome } from '@/layouts/AuthLayout'
import { useAuthStore } from '@/stores/auth'
import { PATHS, safeRedirect } from '@/router/paths'
import { landingPathFor } from '@/utils/roles'

/**
 * Connexion (SCRUM-25) : redirection vers l'espace du rôle, message générique en cas d'erreur,
 * message explicite pour un compte suspendu ou désactivé, « Se souvenir de moi ».
 */
/** Champ avec icône à gauche (maquette de connexion). */
const FIELD =
  'h-12 w-full rounded-xl border border-line bg-surface pr-3 pl-11 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function FieldIcon({ path }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute top-1/2 left-4 h-[18px] w-[18px] -translate-y-1/2 text-muted"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}

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
    <AuthLayout>
      <AuthCard>
        <BackHome />
        <h1 className="mt-5 text-[32px] font-bold tracking-tight text-ink">Connexion</h1>
        <p className="mt-2 text-sm text-muted">
          Accédez à votre espace fournisseur, porteur de projet ou administrateur.
        </p>

        {notice && (
          <p className="mt-4 rounded-xl bg-success-soft px-3 py-2 text-sm text-success" role="status">
            {notice}
          </p>
        )}

        <form className="mt-7 space-y-5" noValidate onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">
              Adresse e-mail
            </label>
            <div className="relative">
              <FieldIcon path="M4 6h16v12H4zM4 7l8 6 8-6" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="exemple@domaine.com"
                className={FIELD}
                required
                value={form.email}
                onChange={update('email')}
              />
            </div>
            {fieldErrors.email && <p className="mt-1 text-sm text-danger">{fieldErrors.email[0]}</p>}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-semibold text-ink">
                Mot de passe
              </label>
              <Link to={PATHS.forgotPassword} className="text-sm font-medium text-brand-600 hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
            <div className="relative">
              <FieldIcon path="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Entrez votre mot de passe"
                className={FIELD}
                required
                value={form.password}
                onChange={update('password')}
              />
            </div>
            {fieldErrors.password && <p className="mt-1 text-sm text-danger">{fieldErrors.password[0]}</p>}
          </div>

          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4.5 w-4.5 rounded border-slate-300 accent-brand-600"
              checked={form.remember}
              onChange={update('remember')}
            />
            Se souvenir de moi
          </label>

          {error && !hasFieldErrors && (
            <p
              className={`rounded-xl px-3 py-2 text-sm ${error.blocked ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}
              role="alert"
            >
              {error.text}
            </p>
          )}

          <button type="submit" className="btn-primary h-12 w-full gap-2 rounded-xl text-[15px] font-semibold shadow-sm" disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-sm text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          Ou
          <span className="h-px flex-1 bg-line" />
        </div>

        <Link
          to={PATHS.register}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-brand-100 bg-surface text-[15px] font-semibold text-ink transition hover:border-brand-500 hover:bg-brand-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-brand-600" aria-hidden="true">
            <path d="M5 21V4h10v17M15 9h4v12M9 8h2M9 12h2M9 16h2M3 21h18" />
          </svg>
          Accès entreprise
        </Link>

        <p className="mt-6 text-center text-sm text-muted">
          Pas encore de compte ?{' '}
          <Link to={PATHS.registerChoice} className="font-semibold text-brand-600 hover:underline">
            Inscrire mon entreprise
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  )
}
