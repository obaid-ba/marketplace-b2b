import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import AuthCard from '@/components/AuthCard'
import { resendVerificationEmail } from '@/api/emailVerification'
import { selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import { landingPathFor } from '@/utils/roles'

const COOLDOWN_SECONDS = 60 // identique à la limite de l'API (1 envoi par minute)

/** « Consultez votre boîte mail » : affichée tant que l'adresse e-mail n'est pas vérifiée (SCRUM-24). */
export default function VerifyEmailNoticeView() {
  const user = useAuthStore(selectUser)
  const fetchMe = useAuthStore((state) => state.fetchMe)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', text }

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleResend() {
    setSending(true)
    setFeedback(null)
    try {
      const message = await resendVerificationEmail()
      setFeedback({ type: 'success', text: message })
      setCooldown(COOLDOWN_SECONDS)
    } catch (e) {
      if (e.response?.data?.reason === 'already_verified') {
        await handleCheck()
        return
      }
      setFeedback({ type: 'error', text: e.userMessage ?? "Impossible d'envoyer le lien." })
      if (e.response?.status === 429) setCooldown(COOLDOWN_SECONDS)
    } finally {
      setSending(false)
    }
  }

  // L'utilisateur a peut-être cliqué sur le lien depuis un autre appareil : on recharge son état.
  async function handleCheck() {
    setChecking(true)
    setFeedback(null)
    await fetchMe()
    const fresh = useAuthStore.getState().user
    setChecking(false)
    if (!fresh) {
      navigate(PATHS.login)
    } else if (fresh.email_verified) {
      navigate(landingPathFor(fresh))
    } else {
      setFeedback({ type: 'error', text: "Votre adresse n'est pas encore confirmée. Cliquez sur le lien reçu par e-mail." })
    }
  }

  async function handleLogout() {
    await logout()
    navigate(PATHS.login)
  }

  return (
    <AuthCard icon="✉️" title="Consultez votre boîte mail">
      <p>
        Nous avons envoyé un lien de confirmation à <strong className="text-slate-900">{user?.email}</strong>. Cliquez
        dessus pour activer votre compte.
      </p>
      <p>Le lien est valable 60 minutes. Pensez à vérifier vos courriers indésirables.</p>

      {feedback && (
        <p
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg px-3 py-2 ${feedback.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}
        >
          {feedback.text}
        </p>
      )}

      <div className="space-y-2 pt-2">
        <button type="button" className="btn-primary w-full" onClick={handleCheck} disabled={checking}>
          {checking ? 'Vérification…' : "J'ai confirmé mon adresse"}
        </button>
        <button
          type="button"
          className="btn-ghost w-full border border-slate-300"
          onClick={handleResend}
          disabled={sending || cooldown > 0}
        >
          {sending ? 'Envoi…' : cooldown > 0 ? `Renvoyer le lien (${cooldown} s)` : 'Renvoyer le lien'}
        </button>
      </div>

      <p className="text-center">
        Mauvaise adresse ?{' '}
        <button type="button" className="text-brand-600 hover:underline" onClick={handleLogout}>
          Se déconnecter
        </button>
      </p>
    </AuthCard>
  )
}
