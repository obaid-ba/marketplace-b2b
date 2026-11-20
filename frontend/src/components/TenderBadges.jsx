import StatusBadge from './StatusBadge'

const TENDER_VARIANTS = {
  ouverte: 'success',
  'en négociation': 'pending',
  clôturée: 'neutral',
  annulée: 'danger',
}

const TENDER_LABELS = {
  ouverte: 'Ouverte',
  'en négociation': 'En négociation',
  clôturée: 'Clôturée',
  annulée: 'Annulée',
}

const QUOTE_VARIANTS = {
  envoyé: 'pending',
  'en négociation': 'pending',
  accepté: 'success',
  refusé: 'danger',
}

const QUOTE_LABELS = {
  envoyé: 'Envoyé',
  'en négociation': 'En négociation',
  accepté: 'Accepté',
  refusé: 'Refusé',
}

/** Statut d'une demande (F11/F13). */
export function TenderStatusBadge({ status, label }) {
  return (
    <StatusBadge variant={TENDER_VARIANTS[status] ?? 'neutral'}>
      {label ?? TENDER_LABELS[status] ?? status ?? '—'}
    </StatusBadge>
  )
}

/** Statut d'un devis (F13/F14). */
export function QuoteStatusBadge({ status, label }) {
  return (
    <StatusBadge variant={QUOTE_VARIANTS[status] ?? 'neutral'}>
      {label ?? QUOTE_LABELS[status] ?? status ?? '—'}
    </StatusBadge>
  )
}
