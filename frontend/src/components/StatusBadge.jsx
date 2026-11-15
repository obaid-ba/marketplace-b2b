import { SUPPLIER_STATUS } from '@/utils/roles'

const VARIANTS = {
  success: 'bg-success-soft text-success',
  pending: 'bg-accent-soft text-accent',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-page text-muted',
}

/** Variante associée à un statut de validation de l'API (« validé », « en attente », « refusé »). */
export function variantForStatus(status) {
  if (status === SUPPLIER_STATUS.VALIDATED) return 'success'
  if (status === SUPPLIER_STATUS.PENDING) return 'pending'
  if (status === SUPPLIER_STATUS.REJECTED) return 'danger'
  return 'neutral'
}

/**
 * Pastille de statut réutilisable.
 * <StatusBadge variant="success">Validé</StatusBadge> ou <StatusBadge status="en attente" />
 */
export default function StatusBadge({ variant, status, children }) {
  const resolved = variant ?? variantForStatus(status)
  const label = children ?? defaultLabel(status)

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${VARIANTS[resolved] ?? VARIANTS.neutral}`}
    >
      {label}
    </span>
  )
}

function defaultLabel(status) {
  if (status === SUPPLIER_STATUS.VALIDATED) return 'Validé'
  if (status === SUPPLIER_STATUS.PENDING) return 'En attente'
  if (status === SUPPLIER_STATUS.REJECTED) return 'Refusé'
  return status ?? ''
}
