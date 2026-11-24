import { useCallback, useEffect, useState } from 'react'
import { createExport, downloadExport, fetchExports } from '@/api/adminExports'
import Modal from '@/components/Modal'
import { formatDate, periodError } from '@/utils/period'

const STATUS_LABELS = {
  'en attente': 'En attente',
  'en cours': 'En cours',
  prêt: 'Prêt',
  échec: 'Échec',
}

const STATUS_CLASSES = {
  'en attente': 'bg-amber-50 text-amber-800',
  'en cours': 'bg-sky-50 text-sky-800',
  prêt: 'bg-emerald-50 text-emerald-800',
  échec: 'bg-rose-50 text-rose-800',
}

/**
 * Fenêtre d'export des statistiques (SCRUM-75 / F28).
 *
 * CSV uniquement : le format XLSX reste bloqué par la question Q7
 * (validation de la dépendance). Le fichier est produit par un job : la liste
 * se rafraîchit et le bouton de téléchargement apparaît quand il est prêt.
 */
export default function AdminExportDialog({ open, defaultRange, onClose }) {
  const [from, setFrom] = useState(defaultRange?.from ?? '')
  const [to, setTo] = useState(defaultRange?.to ?? '')
  const [exports, setExports] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [downloading, setDownloading] = useState(null)

  const loadExports = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchExports()
      setExports(result?.data ?? [])
    } catch (requestError) {
      setError(requestError.userMessage ?? 'Impossible de charger vos exports.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setFrom(defaultRange?.from ?? '')
    setTo(defaultRange?.to ?? '')
    setError(null)
    setNotice(null)
    loadExports()
  }, [open, defaultRange, loadExports])

  async function handleSubmit(event) {
    event.preventDefault()
    const message = periodError(from, to)
    if (message) {
      setError(message)
      return
    }

    setSubmitting(true)
    setError(null)
    setNotice(null)

    try {
      const result = await createExport({ from, to, format: 'csv' })
      setNotice(result?.message ?? 'Votre export est en préparation.')
      await loadExports()
    } catch (requestError) {
      setError(requestError.userMessage ?? "L'export n'a pas pu être lancé.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownload(id) {
    setDownloading(id)
    setError(null)
    try {
      await downloadExport(id)
    } catch (requestError) {
      setError(requestError.userMessage ?? 'Le téléchargement a échoué.')
    } finally {
      setDownloading(null)
    }
  }

  if (!open) return null

  return (
    <Modal title="Exporter les statistiques" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Du</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Au</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Format</span>
          <select
            value="csv"
            disabled
            className="w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-muted"
          >
            <option value="csv">CSV (séparateur point-virgule)</option>
          </select>
          <span className="mt-1 block text-xs text-muted">
            Le format XLSX sera disponible après validation de la dépendance (Q7).
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800">
            {notice}
          </p>
        )}

        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Préparation…' : 'Lancer l’export'}
          </button>
        </div>
      </form>

      <section className="mt-6" aria-labelledby="export-history-title">
        <h3 id="export-history-title" className="text-sm font-semibold text-ink">
          Mes exports récents
        </h3>

        {loading && <p className="mt-2 text-sm text-muted">Chargement…</p>}

        {!loading && exports.length === 0 && (
          <p className="mt-2 text-sm text-muted">Aucun export pour le moment.</p>
        )}

        {exports.length > 0 && (
          <ul className="mt-2 divide-y divide-line">
            {exports.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {formatDate(String(item.period_from ?? '').slice(0, 10))} —{' '}
                    {formatDate(String(item.period_to ?? '').slice(0, 10))}
                  </p>
                  <p className="text-xs text-muted">
                    Export #{item.id} · {item.format?.toUpperCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_CLASSES[item.status] ?? 'bg-page text-muted'
                    }`}
                  >
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                  {item.status === 'prêt' && (
                    <button
                      type="button"
                      className="btn btn-secondary text-xs"
                      onClick={() => handleDownload(item.id)}
                      disabled={downloading === item.id}
                    >
                      {downloading === item.id ? 'Téléchargement…' : 'Télécharger'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Modal>
  )
}
