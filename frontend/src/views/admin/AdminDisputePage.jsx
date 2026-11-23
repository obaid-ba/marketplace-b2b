import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { decideDispute, fetchAdminDispute, takeDispute } from '@/api/disputes'
import { DISPUTE_STATUS, DisputeContent, DisputeStatusBadge } from '@/components/disputes/DisputeParts'
import Modal from '@/components/Modal'
import PageHeader from '@/components/PageHeader'
import { PATHS } from '@/router/paths'
import { selectUser, useAuthStore } from '@/stores/auth'
import { formatAmount } from '@/utils/money'

const MIN_NOTE = 10

function Party({ title, party }) {
  return (
    <section className="card">
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <p className="mt-2 font-semibold text-ink">{party.name}</p>
      {party.contact && (
        <p className="mt-1 text-sm break-words text-muted">
          {party.contact.name}
          <br />
          <a href={`mailto:${party.contact.email}`} className="text-brand-600 hover:underline">
            {party.contact.email}
          </a>
          {party.contact.phone && (
            <>
              <br />
              {party.contact.phone}
            </>
          )}
        </p>
      )}
    </section>
  )
}

/** Traitement d'un litige par l'administrateur (SCRUM-117 / F23) : prise en charge puis décision motivée. */
export default function AdminDisputePage() {
  const { id } = useParams()
  const me = useAuthStore(selectUser)
  const [dispute, setDispute] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [acting, setActing] = useState(false)
  const [decision, setDecision] = useState('')
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)

  const apply = useCallback((result) => {
    setDispute(result.data)
    setDecisions(result.decisions)
  }, [])

  const load = useCallback(async () => {
    try {
      apply(await fetchAdminDispute(id))
      setError(null)
    } catch (err) {
      setError(err.response?.status === 404 ? 'Litige introuvable.' : (err.userMessage ?? 'Impossible de charger le litige.'))
    }
  }, [apply, id])

  useEffect(() => {
    setDispute(null)
    load()
  }, [load])

  async function run(action) {
    setActing(true)
    setActionError(null)
    try {
      apply(await action())
    } catch (err) {
      setActionError(Object.values(err.fieldErrors ?? {})[0]?.[0] ?? err.userMessage ?? "L'action a échoué.")
      if (err.response?.status === 422) load() // un collègue a pu agir entre-temps
    } finally {
      setActing(false)
      setConfirming(false)
    }
  }

  if (error && !dispute) {
    return (
      <div className="card text-center">
        <p className="text-sm text-danger">{error}</p>
        <Link to={PATHS.adminDisputes} className="btn-secondary mt-4">
          Tous les litiges
        </Link>
      </div>
    )
  }
  if (!dispute) return <div className="card text-sm text-muted">Chargement du litige…</div>

  const decided = dispute.status === DISPUTE_STATUS.DECIDED
  const mine = dispute.assigned_admin?.id === me?.id
  const canDecide = decision !== '' && note.trim().length >= MIN_NOTE && !acting

  return (
    <>
      <PageHeader
        title={`Litige — commande n° ${dispute.order_id}`}
        subtitle={`Ouvert le ${new Date(dispute.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`}
        actions={
          <Link to={PATHS.adminDisputes} className="btn-secondary">
            Tous les litiges
          </Link>
        }
      />
      <p className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted">
        <DisputeStatusBadge status={dispute.status} />
        {dispute.assigned_admin && `Pris en charge par ${mine ? 'vous' : dispute.assigned_admin.name}`}
      </p>

      {actionError && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {actionError}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DisputeContent dispute={dispute} />

          {!decided && !mine && (
            <section className="card">
              <p className="text-sm text-muted">
                {dispute.assigned_admin
                  ? `${dispute.assigned_admin.name} traite ce litige. Vous pouvez le reprendre ; l'action est tracée.`
                  : 'Prenez le litige en charge pour rendre une décision. Les deux parties seront prévenues.'}
              </p>
              <button type="button" className="btn-primary mt-4" onClick={() => run(() => takeDispute(id))} disabled={acting}>
                {dispute.assigned_admin ? 'Reprendre le litige' : 'Prendre en charge'}
              </button>
            </section>
          )}

          {!decided && mine && (
            <form
              className="card space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (canDecide) setConfirming(true)
              }}
            >
              <h2 className="text-sm font-semibold text-ink">Rendre une décision</h2>
              <fieldset className="space-y-2">
                <legend className="sr-only">Décision</legend>
                {decisions.map((item) => (
                  <label key={item} className="flex items-center gap-2 text-sm text-ink">
                    <input type="radio" name="decision" className="accent-brand-600" checked={decision === item} onChange={() => setDecision(item)} />
                    {item}
                  </label>
                ))}
              </fieldset>
              <div>
                <label htmlFor="decision-note" className="mb-1 block text-sm font-medium text-ink">
                  Motif, envoyé aux deux parties
                </label>
                <textarea id="decision-note" rows={4} maxLength={2000} className="input" value={note} onChange={(event) => setNote(event.target.value)} />
              </div>
              <button type="submit" className="btn-primary" disabled={!canDecide}>
                Rendre la décision
              </button>
            </form>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Commande</h2>
            <p className="mt-2 text-2xl font-semibold text-ink">{formatAmount(dispute.order.total)}</p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {dispute.items?.map((item) => (
                <li key={item.id}>
                  {item.quantity} × {item.label}
                </li>
              ))}
            </ul>
            <ol className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
              {dispute.status_history?.map((step) => (
                <li key={step.id} className="flex justify-between gap-3">
                  <span className="text-ink capitalize">{step.status}</span>
                  <span className="text-muted">{new Date(step.changed_at).toLocaleDateString('fr-FR')}</span>
                </li>
              ))}
            </ol>
          </section>
          <Party title="Acheteur" party={dispute.buyer} />
          <Party title="Fournisseur" party={dispute.supplier} />
        </aside>
      </div>

      {confirming && (
        <Modal
          title={`Confirmer : ${decision}`}
          onClose={() => setConfirming(false)}
          actions={
            <>
              <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
                Annuler
              </button>
              <button type="button" className="btn-primary" onClick={() => run(() => decideDispute(id, { decision, note: note.trim() }))} disabled={acting}>
                {acting ? 'Envoi…' : 'Confirmer la décision'}
              </button>
            </>
          }
        >
          <p>La décision est définitive. Elle sera envoyée par e-mail à l'acheteur et au fournisseur avec votre motif.</p>
          <p className="mt-2">Aucun remboursement n'est déclenché automatiquement par la plateforme.</p>
        </Modal>
      )}
    </>
  )
}
