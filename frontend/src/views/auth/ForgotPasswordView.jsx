import { useState } from 'react'
import { Link } from 'react-router'
import AuthCard from '@/components/AuthCard'
import { requestPasswordReset } from '@/api/passwordReset'
import { PATHS } from '@/router/paths'

/** « Mot de passe oublié » (SCRUM-26) : même message affiché que l'adresse existe ou non. */
export default function ForgotPasswordView() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentMessage, setSentMessage] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      setSentMessage(await requestPasswordReset(email.trim()))
    } catch (e) {
      setError(e.fieldErrors?.email?.[0] ?? e.userMessage ?? "Impossible d'envoyer la demande.")
    } finally {
      setLoading(false)
    }
  }

  if (sentMessage) {
    return (
      <AuthCard icon="✉️" title="Consultez votre boîte mail">
        <p>{sentMessage}</p>
        <p>Le lien est valable 60 minutes. Pensez à vérifier vos courriers indésirables.</p>
        <Link to={PATHS.login} className="btn-primary w-full">
          Retour à la connexion
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Mot de passe oublié">
      <p>Saisissez l'adresse e-mail de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>

      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-900">
            Adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Envoi…' : 'Recevoir le lien'}
        </button>
      </form>

      <p className="text-center">
        <Link to={PATHS.login} className="text-brand-600 hover:underline">
          ← Retour à la connexion
        </Link>
      </p>
    </AuthCard>
  )
}
