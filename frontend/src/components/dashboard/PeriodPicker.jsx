import { useEffect, useState } from 'react'
import { periodError } from '@/utils/period'

/**
 * Sélecteur de période commun aux tableaux de bord (F26–F28).
 * Champs natifs `<input type="date">` : aucune dépendance supplémentaire.
 */
export default function PeriodPicker({ from, to, onApply, loading = false }) {
  const [values, setValues] = useState({ from, to })
  const [error, setError] = useState(null)

  useEffect(() => {
    setValues({ from, to })
  }, [from, to])

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setError(null)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const message = periodError(values.from, values.to)
    if (message) {
      setError(message)
      return
    }
    onApply?.(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="dashboard-from" className="block text-xs font-medium text-muted">
            Du
          </label>
          <input
            id="dashboard-from"
            name="from"
            type="date"
            value={values.from}
            max={values.to || undefined}
            onChange={(event) => update('from', event.target.value)}
            className="input mt-1"
          />
        </div>

        <div className="flex-1">
          <label htmlFor="dashboard-to" className="block text-xs font-medium text-muted">
            Au
          </label>
          <input
            id="dashboard-to"
            name="to"
            type="date"
            value={values.to}
            min={values.from || undefined}
            onChange={(event) => update('to', event.target.value)}
            className="input mt-1"
          />
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Actualisation...' : 'Actualiser'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  )
}
