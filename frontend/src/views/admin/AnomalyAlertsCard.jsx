import { useEffect, useState } from 'react'
import { decideAnomaly, fetchAnomalies, scanAnomalies } from '@/api/adminAnomalies'
import EmptyState from '@/components/dashboard/EmptyState'
import { formatDate } from '@/utils/period'

function scoreTone(score) {
  if (score >= 70) return 'bg-danger-soft text-danger'
  if (score >= 40) return 'bg-accent-soft text-accent'
  return 'bg-page text-muted'
}

/**
 * Alertes d'anomalie du tableau de bord administrateur (SCRUM-86) : comptes et commandes au comportement
 * inhabituel, du plus grave au moins grave. L'admin marque chaque alerte « traitée » ou « ignorée » ;
 * rien n'est bloqué automatiquement. initialAlerts : alertes renvoyées par GET /admin/dashboard.
 */
export default function AnomalyAlertsCard({ initialAlerts = [] }) {
  const [alerts, setAlerts] = useState(initialAlerts)
  const [busy, setBusy] = useState(null) // id de l'alerte en cours, ou 'scan'
  const [notice, setNotice] = useState(null)

  useEffect(() => setAlerts(initialAlerts), [initialAlerts])

  async function reload() {
    const result = await fetchAnomalies({ per_page: 5 })
    setAlerts(result.data)
  }

  async function scan() {
    setBusy('scan')
    setNotice(null)
    try {
      const result = await scanAnomalies()
      setNotice({ type: 'success', text: result.message })
      await reload()
    } catch (err) {
      setNotice({ type: 'error', text: err.userMessage ?? 'L’analyse a échoué.' })
    } finally {
      setBusy(null)
    }
  }

  async function decide(alert, decision) {
    setBusy(alert.id)
    setNotice(null)
    try {
      const result = await decideAnomaly(alert.id, decision)
      setAlerts((current) => current.filter((item) => item.id !== alert.id))
      setNotice({ type: 'success', text: result.message })
    } catch (err) {
      setNotice({ type: 'error', text: err.userMessage ?? 'La décision n’a pas pu être enregistrée.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card" aria-labelledby="anomaly-alerts-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="anomaly-alerts-title" className="text-base font-semibold text-ink">
            Alertes d&apos;anomalie
          </h2>
          <p className="mt-1 text-sm text-muted">Pics de commandes, avis en rafale, montants inhabituels, litiges répétés</p>
        </div>
        <button type="button" className="btn-secondary shrink-0" onClick={scan} disabled={busy !== null}>
          {busy === 'scan' ? 'Analyse…' : 'Analyser maintenant'}
        </button>
      </div>

      {notice && (
        <p
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${notice.type === 'error' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`}
        >
          {notice.text}
        </p>
      )}

      <div className="mt-4">
        {alerts.length === 0 ? (
          <EmptyState title="Aucune alerte d'anomalie" description="La détection tourne automatiquement toutes les 15 minutes." />
        ) : (
          <ul className="divide-y divide-line">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${scoreTone(alert.score)}`}>
                      Score {Math.round(alert.score)}
                    </span>
                    <span className="first-letter:uppercase">{alert.anomaly_type}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {alert.target_label} · détectée le {formatDate(alert.created_at?.slice(0, 10))}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1.5 text-sm"
                    onClick={() => decide(alert, 'handle')}
                    disabled={busy !== null}
                    aria-label={`Marquer « ${alert.anomaly_type} » comme traitée`}
                  >
                    Traitée
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-sm"
                    onClick={() => decide(alert, 'ignore')}
                    disabled={busy !== null}
                    aria-label={`Ignorer « ${alert.anomaly_type} »`}
                  >
                    Ignorer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
