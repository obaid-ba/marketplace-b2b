import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import { PATHS, safeRedirect } from '@/router/paths'
import { homePathFor } from '@/utils/roles'

export default function LoginView() {
  const login = useAuthStore((state) => state.login)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setFieldErrors({})
    try {
      const user = await login(form.email.trim(), form.password)
      navigate(safeRedirect(searchParams.get('redirect')) ?? homePathFor(user.role))
    } catch (e) {
      setError(e.userMessage ?? 'Connexion impossible.')
      setFieldErrors(e.fieldErrors ?? {})
      setLoading(false)
    }
  }

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
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Mot de passe
            </label>
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

          {error && !Object.keys(fieldErrors).length && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        {/* "Mot de passe oublié" et "S'inscrire" arrivent en S1 (SCRUM-21 à SCRUM-26) */}
      </div>
    </div>
  )
}
