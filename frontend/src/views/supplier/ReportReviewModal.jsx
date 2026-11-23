import { useState } from 'react'
import { reportReview } from '@/api/reviews'
import Modal from '@/components/Modal'

// Mêmes valeurs que App\Models\ReviewReport::REASONS.
const REASONS = [
  { value: 'insultes', label: 'Propos injurieux ou diffamatoires' },
  { value: 'faux_avis', label: 'Faux avis ou avis intéressé' },
  { value: 'hors_sujet', label: 'Sans rapport avec la commande' },
  { value: 'donnees_personnelles', label: 'Divulgation de données personnelles' },
  { value: 'autre', label: 'Autre motif' },
]

/** Signaler un avis abusif à l'administrateur (SCRUM-66). */
export default function ReportReviewModal({ review, onClose, onReported }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const detailsRequired = reason === 'autre'
  const canSend = reason !== '' && (!detailsRequired || details.trim() !== '') && !sending

  async function submit() {
    setSending(true)
    setError(null)
    try {
      const result = await reportReview(review.id, { reason, details: details.trim() || undefined })
      onReported(result)
    } catch (err) {
      const first = Object.values(err.fieldErrors ?? {})[0]?.[0]
      setError(first ?? err.userMessage ?? "Le signalement n'a pas pu être envoyé.")
      setSending(false)
    }
  }

  return (
    <Modal
      title="Signaler cet avis"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={!canSend}>
            {sending ? 'Envoi…' : 'Envoyer le signalement'}
          </button>
        </>
      }
    >
      <p>L'administrateur examinera l'avis. Il reste visible jusqu'à sa décision.</p>
      <fieldset className="mt-4 space-y-2">
        <legend className="mb-2 font-medium text-ink">Motif</legend>
        {REASONS.map((item) => (
          <label key={item.value} className="flex items-center gap-2 text-ink">
            <input type="radio" name="reason" className="accent-brand-600" checked={reason === item.value} onChange={() => setReason(item.value)} />
            {item.label}
          </label>
        ))}
      </fieldset>
      <label htmlFor="report-details" className="mt-4 mb-1 block font-medium text-ink">
        Précisions {detailsRequired ? '(obligatoires)' : '(facultatif)'}
      </label>
      <textarea id="report-details" rows={3} maxLength={1000} className="input" value={details} onChange={(event) => setDetails(event.target.value)} />
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-danger">
          {error}
        </p>
      )}
    </Modal>
  )
}
