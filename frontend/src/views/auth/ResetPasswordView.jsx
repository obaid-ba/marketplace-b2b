import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import AuthCard from '@/components/AuthCard'
import { resetPassword } from '@/api/passwordReset'
import { useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import { PASSWORD_RULES, isStrongPassword } from '@/utils/passwordRules'

/**
 * « Nouveau mot de passe » (SCRUM-26), ouverte par le lien reçu par e-mail (?token=…&email=…).
 * Mot de passe saisi deux fois, règles de robustesse affichées en direct, puis retour à la connexion.
 */
export default function ResetPasswordView() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const email = searchParams.get('email')
  const navigate = useNavigate()
  const clearSession = useAuthStore((state) => state.clear)

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null) // { text, linkInvalid }

  if (!token || !email) {
    return <InvalidLink />
  }

  const strong = isStrongPassword(password)
  const matches = password === confirmation

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
    setError(null)
    if (!strong || !matches) return

    setLoading(true)
    try {
      const message = await resetPassword({ token, email, password, passwordConfirmation: confirmation })
      // Toutes les sessions ont été fermées côté API : on oublie aussi le jeton local.
      clearSession()
      navigate(PATHS.login, { replace: true, state: { notice: message, email } })
    } catch (e) {
      const linkInvalid = e.response?.data?.reason === 'invalid_token'
      setError({ text: e.fieldErrors?.password?.[0] ?? e.userMessage ?? 'Modification impossible.', linkInvalid })
      setLoading(false)
    }
  }

  if (error?.linkInvalid) {
    return <InvalidLink message={error.text} />
  }

  return (
    <AuthCard title="Nouveau mot de passe">
      <p>
        Choisissez un nouveau mot de passe pour <strong className="text-slate-900">{email}</strong>.
      </p>

      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-900">
            Nouveau mot de passe
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="input"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-rules"
          />
          <ul id="password-rules" className="mt-2 grid grid-cols-2 gap-1 text-xs">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(password)
              return (
                <li key={rule.id} className={ok ? 'text-green-700' : submitted ? 'text-red-600' : 'text-slate-500'}>
                  {ok ? '✓' : '•'} {rule.label}
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <label htmlFor="password_confirmation" className="mb-1 block text-sm font-medium text-slate-900">
            Confirmer le mot de passe
          </label>
          <input
            id="password_confirmation"
            type="password"
            autoComplete="new-password"
            className="input"
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          {submitted && !matches && (
            <p className="mt-1 text-sm text-red-600">Les deux mots de passe ne correspondent pas.</p>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700" role="alert">
            {error.text}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </button>
      </form>
    </AuthCard>
  )
}

function InvalidLink({ message }) {
  return (
    <AuthCard icon="⚠️" title="Lien invalide ou expiré">
      <p>{message ?? "Ce lien de réinitialisation n'est pas complet. Vérifiez que vous avez copié l'adresse en entier."}</p>
      <Link to={PATHS.forgotPassword} className="btn-primary w-full">
        Faire une nouvelle demande
      </Link>
    </AuthCard>
  )
}
