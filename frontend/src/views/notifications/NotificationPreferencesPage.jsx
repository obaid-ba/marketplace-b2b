import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '@/api/notifications'
import PageHeader from '@/components/PageHeader'
import WhatsAppSettings from '@/components/WhatsAppSettings'
import { PATHS, notificationsPathFor } from '@/router/paths'
import { selectRole, useAuthStore } from '@/stores/auth'

const CHANNELS = [
  { id: 'site', title: 'Sur le site', label: 'sur le site' },
  { id: 'email', title: 'Par e-mail', label: 'par e-mail' },
  { id: 'whatsapp', title: 'WhatsApp', label: 'par WhatsApp' },
]

/**
 * Préférences de notification (SCRUM-63 / F15) : une case par événement et par canal.
 * Les e-mails critiques (commande validée, compte validé/refusé, litige) restent
 * verrouillés : la règle est aussi appliquée côté serveur.
 */
export default function NotificationPreferencesPage() {
  const role = useAuthStore(selectRole)
  const [rows, setRows] = useState([])
  const [whatsapp, setWhatsapp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true

    fetchNotificationPreferences()
      .then((result) => {
        if (active) apply(result)
      })
      .catch((failure) => {
        if (active) setError(failure.userMessage ?? 'Impossible de charger vos préférences.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  function apply(result) {
    setRows(result.preferences)
    setWhatsapp(result.whatsapp)
  }

  /** Consentement WhatsApp : met à jour la colonne sans perdre les cases pas encore enregistrées. */
  function applyConsent(result) {
    const pending = new Map(rows.map((row) => [row.event_type, row.channels]))
    setRows(
      result.preferences.map((row) => ({
        ...row,
        channels: { ...row.channels, site: pending.get(row.event_type)?.site ?? row.channels.site, email: pending.get(row.event_type)?.email ?? row.channels.email },
      })),
    )
    setWhatsapp(result.whatsapp)
    setNotice(result.message)
  }

  // La colonne WhatsApp n'existe qu'une fois le consentement donné (l'API l'ajoute alors à chaque ligne).
  const channels = CHANNELS.filter(({ id }) => rows[0]?.channels[id])

  function toggle(eventType, channel) {
    setNotice(null)
    setRows((current) =>
      current.map((row) => {
        if (row.event_type !== eventType) return row

        const currentChannel = row.channels[channel]
        if (currentChannel.locked) return row

        return {
          ...row,
          channels: {
            ...row.channels,
            [channel]: { ...currentChannel, enabled: !currentChannel.enabled },
          },
        }
      }),
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setNotice(null)

    const preferences = rows.flatMap((row) =>
      channels.map(({ id }) => ({
        event_type: row.event_type,
        channel: id,
        enabled: row.channels[id].enabled,
      })),
    )

    try {
      apply(await updateNotificationPreferences(preferences))
      setNotice('Vos préférences sont enregistrées.')
    } catch (failure) {
      setError(failure.userMessage ?? 'L’enregistrement a échoué.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Préférences de notification"
        subtitle="Choisissez les événements reçus sur le site, par e-mail et par WhatsApp."
        actions={
          <Link to={notificationsPathFor(role) ?? PATHS.account} className="btn-secondary">
            Mes notifications
          </Link>
        }
      />

      {notice && (
        <div className="mb-4 rounded-lg border border-success-soft bg-success-soft/60 px-4 py-3 text-sm text-success">
          {notice}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-danger-soft bg-danger-soft/50 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {whatsapp && <WhatsAppSettings state={whatsapp} onChange={applyConsent} />}

      {loading ? (
        <div className="card text-sm text-muted">Chargement des préférences…</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm sm:min-w-140">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="pb-3 font-medium">Événement</th>
                {channels.map(({ id, title }) => (
                  <th key={id} className="px-1 pb-3 text-center font-medium">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.event_type} className="border-b border-line last:border-0">
                  <td className="py-3 pr-4">
                    <span className="text-ink">{row.label}</span>
                    {row.critical_email && (
                      <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                        E-mail critique
                      </span>
                    )}
                  </td>

                  {channels.map(({ id: channel, label }) => {
                    const state = row.channels[channel]

                    return (
                      <td key={channel} className="py-3 text-center">
                        <label className="inline-flex cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-100 disabled:opacity-60"
                            checked={state.enabled}
                            disabled={state.locked}
                            onChange={() => toggle(row.event_type, channel)}
                            aria-label={`${row.label} — ${label}`}
                          />
                        </label>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-muted">
              Les e-mails critiques restent toujours envoyés, même si vous désactivez le canal.
            </p>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer les préférences'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
