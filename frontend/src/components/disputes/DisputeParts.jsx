import { useState } from 'react'
import { downloadDisputeAttachment } from '@/api/disputes'
import StatusBadge from '@/components/StatusBadge'
import { formatFileSize } from '@/views/messaging/messageUtils'

// Mêmes valeurs que App\Enums\DisputeStatus.
export const DISPUTE_STATUS = Object.freeze({ OPEN: 'ouvert', IN_PROGRESS: 'en cours', DECIDED: 'décidé' })

const STATUS = {
  [DISPUTE_STATUS.OPEN]: { label: 'Ouvert', variant: 'danger' },
  [DISPUTE_STATUS.IN_PROGRESS]: { label: 'En cours', variant: 'pending' },
  [DISPUTE_STATUS.DECIDED]: { label: 'Décidé', variant: 'success' },
}

export function disputeStatusLabel(status) {
  return STATUS[status]?.label ?? status
}

export function DisputeStatusBadge({ status }) {
  return <StatusBadge variant={STATUS[status]?.variant ?? 'neutral'}>{disputeStatusLabel(status)}</StatusBadge>
}

/** Preuves jointes : fichiers privés, téléchargés par l'API. */
export function DisputeAttachments({ dispute }) {
  const [error, setError] = useState(null)
  if (!dispute.attachments?.length) return <p className="text-sm text-muted">Aucune pièce jointe.</p>

  async function download(attachment) {
    setError(null)
    try {
      await downloadDisputeAttachment(dispute.id, attachment)
    } catch {
      setError("La pièce jointe n'a pas pu être téléchargée.")
    }
  }

  return (
    <>
      <ul className="space-y-1">
        {dispute.attachments.map((attachment) => (
          <li key={attachment.id}>
            <button
              type="button"
              onClick={() => download(attachment)}
              className="flex max-w-full items-center gap-2 text-left text-sm text-brand-600 hover:underline"
            >
              <span aria-hidden="true">📎</span>
              <span className="truncate">{attachment.original_name}</span>
              <span className="shrink-0 text-xs text-muted">{formatFileSize(attachment.size)}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </>
  )
}

/** Description de l'acheteur, preuves et, une fois rendue, décision de l'administrateur. */
export function DisputeContent({ dispute }) {
  return (
    <>
      {dispute.status === DISPUTE_STATUS.DECIDED && (
        <section className="card border-success-soft bg-success-soft/40">
          <h2 className="text-sm font-semibold text-ink">Décision de l'administrateur</h2>
          <p className="mt-2 text-lg font-semibold text-ink">{dispute.decision}</p>
          <p className="mt-1 text-sm whitespace-pre-line text-ink">{dispute.decision_note}</p>
          <p className="mt-2 text-xs text-muted">Rendue le {new Date(dispute.decided_at).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</p>
        </section>
      )}
      <section className="card">
        <h2 className="text-sm font-semibold text-ink">{dispute.reason}</h2>
        <p className="mt-2 text-sm whitespace-pre-line text-muted">{dispute.description}</p>
        <h3 className="mt-4 mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Pièces jointes</h3>
        <DisputeAttachments dispute={dispute} />
      </section>
    </>
  )
}
