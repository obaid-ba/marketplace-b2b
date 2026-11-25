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

// Mêmes codes que App\Models\Export::INDICATORS.
const INDICATORS = [
  { value: 'signups', label: 'Inscriptions' },
  { value: 'orders', label: 'Commandes' },
  { value: 'revenue', label: "Chiffre d'affaires" },
  { value: 'tenders', label: 'Demandes' },
  { value: 'categories', label: 'Catégories' },
]
const ALL = INDICATORS.map((indicator) => indicator.value)

const REFRESH_DELAY = 3000

/**
 * Fenêtre d'export des statistiques (SCRUM-75 / F28).
 *
 * Le fichier (CSV ou XLSX, indicateurs au choix) est produit par un job : la liste
 * se rafraîchit et le bouton de téléchargement apparaît quand il est prêt.
 */
export default function AdminExportDialog({ open, defaultRange, onClose }) {
  const [from, setFrom] = useState(defaultRange?.from ?? '')
  const [to, setTo] = useState(defaultRange?.to ?? '')
  const [format, setFormat] = useState('csv')
  const [indicators, setIndicators] = useState(ALL)
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

  // Tant qu'un export est en préparation, la liste se rafraîchit seule.
  const pending = open && exports.some((item) => ['en attente', 'en cours'].includes(item.status))
  useEffect(() => {
    if (!pending) return undefined
    const timer = setInterval(() => {
      fetchExports()
        .then((result) => setExports(result?.data ?? []))
        .catch(() => {})
    }, REFRESH_DELAY)
    return () => clearInterval(timer)
  }, [pending])

  function toggleIndicator(value) {
    setIndicators((current) => ALL.filter((item) => (item === value ? !current.includes(item) : current.includes(item))))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const message = periodError(from, to)
    if (message) {
      setError(message)
      return
    }
    if (indicators.length === 0) {
      setError('Choisissez au moins un indicateur.')
      return
    }

    setSubmitting(true)
    setError(null)
    setNotice(null)

    try {
      const result = await createExport({ from, to, format, indicators })
      setNotice(result?.message ?? 'Votre export est en préparation.')
      await loadExports()
    } catch (requestError) {
      setError(requestError.userMessage ?? "L'export n'a pas pu être lancé.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownload({ id, format: fileFormat }) {
    setDownloading(id)
    setError(null)
    try {
      await downloadExport(id, fileFormat)
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
            value={format}
            onChange={(event) => setFormat(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="csv">CSV (séparateur point-virgule)</option>
            <option value="xlsx">Excel (XLSX)</option>
          </select>
        </label>

        <fieldset className="text-sm">
          <legend className="mb-1 font-medium text-ink">Indicateurs</legend>
          <div className="grid grid-cols-2 gap-1">
            {INDICATORS.map((indicator) => (
              <label key={indicator.value} className="flex items-center gap-2 text-ink">
                <input type="checkbox" className="accent-brand-600" checked={indicators.includes(indicator.value)} onChange={() => toggleIndicator(indicator.value)} />
                {indicator.label}
              </label>
            ))}
          </div>
        </fieldset>

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
          <ul className="mt-2 max-h-48 divide-y divide-line overflow-y-auto">
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
                      onClick={() => handleDownload(item)}
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
