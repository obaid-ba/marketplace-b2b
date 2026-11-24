import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchOrderDispute } from '@/api/disputes'
import { useRealtime } from '@/realtime/realtime'
import { disputePath, newDisputePath } from '@/router/paths'
import { DISPUTE_STATUS, DisputeStatusBadge } from './DisputeParts'

/**
 * Bloc « Litige » de la page d'une commande (SCRUM-117 / F23) : suivi du dernier litige,
 * ou « Signaler un problème » quand c'est possible (règle R4 vérifiée par l'API).
 * À monter avec key={order.status} : la possibilité dépend de l'étape de la commande.
 */
export default function OrderDisputeCard({ orderId }) {
  const [state, setState] = useState(null)

  const load = useCallback(async () => {
    try {
      setState(await fetchOrderDispute(orderId))
    } catch {
      setState(null) // la page de la commande reste utilisable
    }
  }, [orderId])

  useEffect(() => {
    load()
  }, [load])
  useRealtime('notification.created', load)

  if (!state || (!state.dispute && !state.can_open)) return null
  const { dispute } = state
  const undecided = dispute && dispute.status !== DISPUTE_STATUS.DECIDED

  return (
    <section className="card" aria-label="Litige">
      {dispute && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold text-ink">
              Litige <DisputeStatusBadge status={dispute.status} />
            </p>
            <p className="mt-1 text-sm text-muted">{dispute.decision ? `Décision : ${dispute.decision}` : dispute.reason}</p>
            {undecided && <p className="mt-1 text-sm text-muted">La commande pourra être clôturée après la décision de l'administrateur.</p>}
          </div>
          <Link to={disputePath(dispute.id)} className="btn-secondary">
            Voir le litige
          </Link>
        </div>
      )}
      {state.can_open && (
        <div className={`flex flex-wrap items-center justify-between gap-3 ${dispute ? 'mt-4 border-t border-line pt-4' : ''}`}>
          <p className="text-sm text-muted">
            {dispute ? 'Un autre problème sur cette commande ?' : 'Un problème avec cette commande ? Un administrateur peut intervenir.'}
          </p>
          <Link to={newDisputePath(orderId)} className="btn-secondary">
            Signaler un problème
          </Link>
        </div>
      )}
    </section>
  )
}
