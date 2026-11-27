import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { fetchDispute } from '@/api/disputes'
import ContactButton from '@/components/ContactButton'
import { DISPUTE_STATUS, DisputeContent, DisputeStatusBadge } from '@/components/disputes/DisputeParts'
import PageHeader from '@/components/PageHeader'
import { useRealtime } from '@/realtime/realtime'
import { orderTrackingPath } from '@/router/paths'
import { selectRole, useAuthStore } from '@/stores/auth'
import { ROLES } from '@/utils/roles'

const EXPLANATIONS = {
  [DISPUTE_STATUS.OPEN]: 'Le litige est transmis. Un administrateur va le prendre en charge.',
  [DISPUTE_STATUS.IN_PROGRESS]: 'Un administrateur examine le litige. Vous serez prévenu de sa décision.',
  [DISPUTE_STATUS.DECIDED]: 'La décision est rendue. Elle a été envoyée aux deux parties.',
}

/** Litige vu par l'acheteur et le fournisseur (SCRUM-117 / F23). */
export default function DisputePage() {
  const { id } = useParams()
  const role = useAuthStore(selectRole)
  const [dispute, setDispute] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setDispute(await fetchDispute(id))
      setError(null)
    } catch (err) {
      setError(err.response?.status === 404 ? 'Litige introuvable.' : (err.userMessage ?? 'Impossible de charger le litige.'))
    }
  }, [id])

  useEffect(() => {
    setDispute(null)
    load()
  }, [load])
  useRealtime('notification.created', load)

  if (error && !dispute) return <div className="card text-sm text-danger">{error}</div>
  if (!dispute) return <div className="card text-sm text-muted">Chargement du litige…</div>

  const isSupplier = role === ROLES.SUPPLIER

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Litige — commande n° ${dispute.order_id}`}
        subtitle={`${isSupplier ? `Acheteur : ${dispute.buyer.name}` : `Fournisseur : ${dispute.supplier.name}`} · ouvert le ${new Date(dispute.created_at).toLocaleDateString('fr-FR')}`}
        actions={
          <>
            <ContactButton contextType="commande" contextId={dispute.order_id} label={isSupplier ? "Contacter l'acheteur" : 'Contacter le fournisseur'} />
            <Link to={orderTrackingPath(dispute.order_id)} className="btn-secondary">
              Voir la commande
            </Link>
          </>
        }
      />
      <p className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted">
        <DisputeStatusBadge status={dispute.status} />
        {EXPLANATIONS[dispute.status]}
      </p>
      <div className="space-y-6">
        <DisputeContent dispute={dispute} />
      </div>
    </div>
  )
}
