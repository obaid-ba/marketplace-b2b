import { useState } from 'react'
import { Link } from 'react-router'
import { setWhatsAppConsent } from '@/api/notifications'
import StatusBadge from '@/components/StatusBadge'
import { PATHS } from '@/router/paths'
import { formatRelativeDate } from '@/utils/relativeDate'

const DELIVERY = {
  envoyé: { label: 'Envoyé', variant: 'success' },
  simulé: { label: 'Simulé, non envoyé', variant: 'neutral' },
  échoué: { label: 'Échec', variant: 'danger' },
}

/**
 * Notifications WhatsApp (SCRUM-133) : consentement explicite, numéro masqué, derniers envois.
 * state : bloc « whatsapp » renvoyé par l'API ; onChange reçoit { preferences, whatsapp }.
 */
export default function WhatsAppSettings({ state, onChange }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Service désactivé : rien à proposer, sauf retirer un consentement déjà donné.
  if (!state.available && !state.opted_in) return null

  async function toggle() {
    setSaving(true)
    setError(null)
    try {
      onChange(await setWhatsAppConsent(!state.opted_in))
    } catch (err) {
      setError(err.fieldErrors?.enabled?.[0] ?? err.userMessage ?? "La modification n'a pas été enregistrée.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label="WhatsApp" className="card mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold text-ink">
            WhatsApp
            {state.simulated && state.available && <StatusBadge variant="pending">Mode simulé, rien n'est envoyé</StatusBadge>}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {state.opted_in
              ? `Activé${state.phone ? ` pour le ${state.phone}` : ''}. Choisissez les événements dans le tableau.`
              : state.phone
                ? `Recevez un court message (titre et lien) au ${state.phone}. Vous pouvez arrêter à tout moment.`
                : 'Ajoutez un numéro de téléphone tunisien à votre compte pour utiliser WhatsApp.'}
          </p>
          <p className="mt-1 text-xs text-muted">Si un message WhatsApp ne peut pas être envoyé, vous recevez un e-mail à la place.</p>
          {!state.available && <p className="mt-1 text-sm text-accent">WhatsApp n'est pas disponible pour le moment.</p>}
        </div>
        {state.opted_in || state.phone ? (
          <button type="button" className={state.opted_in ? 'btn-secondary shrink-0' : 'btn-primary shrink-0'} onClick={toggle} disabled={saving}>
            {saving ? 'Enregistrement…' : state.opted_in ? 'Désactiver' : "J'accepte et j'active"}
          </button>
        ) : (
          <Link to={PATHS.account} className="btn-secondary shrink-0">
            Ajouter mon numéro
          </Link>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {state.recent.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-brand-600">Derniers messages</summary>
          <ul className="mt-2 divide-y divide-line">
            {state.recent.map((delivery) => {
              const config = DELIVERY[delivery.status] ?? { label: delivery.status, variant: 'neutral' }
              return (
                <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-ink">{delivery.event}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <StatusBadge variant={config.variant}>{config.label}</StatusBadge>
                    {delivery.email_fallback && 'e-mail envoyé à la place'}
                    <span>{formatRelativeDate(delivery.created_at)}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </details>
      )}
    </section>
  )
}
