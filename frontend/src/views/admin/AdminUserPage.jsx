import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { deleteUser, fetchAdminUser, reactivateUser, suspendUser } from '@/api/adminUsers'
import Modal from '@/components/Modal'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import { PATHS } from '@/router/paths'
import { formatRelativeDate } from '@/utils/relativeDate'
import { ROLES, SUPPLIER_STATUS } from '@/utils/roles'
import { userStatusConfig } from '@/utils/userStatus'

const MIN_REASON = 10

const ACTIVITY_LABELS = {
  orders: 'Commandes',
  ongoing_orders: 'Commandes en cours',
  open_disputes: 'Litiges en cours',
  products: 'Produits',
  quotes: 'Devis envoyés',
  tenders: 'Demandes publiées',
  reports_made: 'Avis qu’il a signalés',
  reports_received: 'Ses avis signalés',
}

const HISTORY_LABELS = {
  'user.suspended': 'Compte suspendu',
  'user.reactivated': 'Compte réactivé',
  'user.deleted': 'Compte supprimé',
  'supplier.validated': 'Dossier fournisseur validé',
  'supplier.rejected': 'Dossier fournisseur refusé',
}

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 border-b border-line py-2.5 text-sm last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  )
}

const ACTIONS = {
  suspend: { title: 'Suspendre', confirm: 'Suspendre le compte', run: suspendUser, notice: 'Compte suspendu. Le motif a été envoyé par e-mail.' },
  reactivate: { title: 'Réactiver', confirm: 'Réactiver le compte', run: reactivateUser, notice: "Compte réactivé. L'utilisateur est prévenu par e-mail." },
  delete: { title: 'Supprimer', confirm: 'Supprimer le compte', run: deleteUser, notice: 'Compte supprimé. Le motif a été envoyé par e-mail.' },
}

/** Ce que la suspension ou la suppression entraîne, selon le rôle et l'activité du compte. */
function BlockingEffects({ user, activity, permanent = false }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5">
      {permanent && <li className="font-medium text-danger">Le compte ne pourra pas être réactivé. Commandes, factures et avis sont conservés.</li>}
      <li>L'utilisateur est déconnecté partout et ne peut plus se connecter.</li>
      <li>Il reçoit un e-mail avec le motif.</li>
      {user.role === ROLES.SUPPLIER && <li>Son profil et ses produits disparaissent du catalogue ; plus aucune commande n'est possible.</li>}
      {activity.ongoing_orders > 0 && (
        <li className="font-medium text-danger">
          {activity.ongoing_orders} commande{activity.ongoing_orders > 1 ? 's' : ''} en cours ne pourr{activity.ongoing_orders > 1 ? 'ont' : 'a'} plus avancer de
          son côté.
        </li>
      )}
    </ul>
  )
}

/** Fiche d'un utilisateur : informations, activité, historique, suspension, réactivation et suppression (SCRUM-118 / F24). */
export default function AdminUserPage() {
  const { id } = useParams()
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const [action, setAction] = useState(null) // clé de ACTIONS
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    try {
      setDetail(await fetchAdminUser(id))
      setError(null)
    } catch (err) {
      setError(err.response?.status === 404 ? 'Utilisateur introuvable.' : (err.userMessage ?? "Impossible de charger l'utilisateur."))
    }
  }, [id])

  useEffect(() => {
    setDetail(null)
    load()
  }, [load])

  function openAction(value) {
    setAction(value)
    setReason('')
    setActionError(null)
    setNotice(null)
  }

  const closeAction = useCallback(() => setAction(null), [])

  async function confirm() {
    setActing(true)
    setActionError(null)
    try {
      setDetail(await ACTIONS[action].run(id, reason.trim()))
      setNotice(ACTIONS[action].notice)
      setAction(null)
    } catch (err) {
      setActionError(Object.values(err.fieldErrors ?? {})[0]?.[0] ?? err.userMessage ?? "L'action a échoué.")
      if (err.response?.status === 422) load() // un collègue a pu agir entre-temps
    } finally {
      setActing(false)
    }
  }

  if (error && !detail) {
    return (
      <div className="card text-center">
        <p className="text-sm text-danger">{error}</p>
        <Link to={PATHS.adminUsers} className="btn-secondary mt-4">
          Tous les utilisateurs
        </Link>
      </div>
    )
  }
  if (!detail) return <div className="card text-sm text-muted">Chargement de l'utilisateur…</div>

  const { user, activity, history } = detail
  const status = userStatusConfig(user.status)

  return (
    <>
      <PageHeader
        title={user.name}
        subtitle={[user.role_label, user.organization].filter(Boolean).join(' · ')}
        actions={
          <>
            {user.can_suspend && (
              <button type="button" className="btn border border-danger bg-surface text-danger hover:bg-danger-soft" onClick={() => openAction('suspend')}>
                Suspendre
              </button>
            )}
            {user.can_reactivate && (
              <button type="button" className="btn-primary" onClick={() => openAction('reactivate')}>
                Réactiver
              </button>
            )}
            {user.can_delete && (
              <button type="button" className="btn border border-danger bg-surface text-danger hover:bg-danger-soft" onClick={() => openAction('delete')}>
                Supprimer
              </button>
            )}
            <Link to={PATHS.adminUsers} className="btn-secondary">
              Tous les utilisateurs
            </Link>
          </>
        }
      />

      {notice && (
        <p role="status" className="mb-4 rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
          {notice}
        </p>
      )}
      {user.locked_reason && <p className="mb-4 rounded-lg bg-page px-4 py-3 text-sm text-muted">{user.locked_reason}</p>}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-ink">Compte</h2>
          <dl>
            <Row label="Statut">
              <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
            </Row>
            <Row label="E-mail">
              <a href={`mailto:${user.email}`} className="text-brand-600 hover:underline">
                {user.email}
              </a>
              {!user.email_verified && <span className="text-muted"> (non vérifié)</span>}
            </Row>
            <Row label="Téléphone">{user.phone ?? '—'}</Row>
            <Row label="Inscription">{formatRelativeDate(user.created_at)}</Row>
            <Row label="Dernière connexion">{user.last_login_at ? formatRelativeDate(user.last_login_at) : 'Jamais'}</Row>
            {user.deleted_at && <Row label="Suppression">{formatRelativeDate(user.deleted_at)}</Row>}
            {user.supplier && (
              <>
                <Row label="Dossier fournisseur">
                  {user.supplier.validation_status === SUPPLIER_STATUS.VALIDATED ? (
                    <StatusBadge status={user.supplier.validation_status} />
                  ) : (
                    <Link to={PATHS.adminSuppliers} className="text-brand-600 hover:underline">
                      {user.supplier.validation_status}
                    </Link>
                  )}
                </Row>
                <Row label="Note">{user.supplier.reviews_count > 0 ? `${user.supplier.rating_avg.toFixed(1)} / 5 (${user.supplier.reviews_count} avis)` : 'Pas encore noté'}</Row>
              </>
            )}
          </dl>
        </section>

        <aside className="space-y-6">
          {Object.keys(activity).length > 0 && (
            <section className="card">
              <h2 className="mb-2 text-sm font-semibold text-ink">Activité</h2>
              <dl>
                {Object.entries(activity).map(([key, value]) => (
                  <Row key={key} label={ACTIVITY_LABELS[key] ?? key}>
                    {value}
                  </Row>
                ))}
              </dl>
            </section>
          )}
          <section className="card">
            <h2 className="mb-2 text-sm font-semibold text-ink">Historique des décisions</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted">Aucune décision sur ce compte.</p>
            ) : (
              <ol className="space-y-3">
                {history.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p className="font-medium text-ink">{HISTORY_LABELS[entry.action] ?? entry.action}</p>
                    {entry.reason && <p className="whitespace-pre-line text-muted">{entry.reason}</p>}
                    <p className="text-xs text-muted">{[formatRelativeDate(entry.created_at), entry.admin].filter(Boolean).join(' · ')}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      {action && (
        <Modal
          title={`${ACTIONS[action].title} ${user.name}`}
          onClose={closeAction}
          actions={
            <>
              <button type="button" className="btn-secondary" onClick={closeAction}>
                Annuler
              </button>
              <button
                type="button"
                className={action === 'delete' ? 'btn bg-danger text-white' : 'btn-primary'}
                onClick={confirm}
                disabled={acting || reason.trim().length < MIN_REASON}
              >
                {acting ? 'Enregistrement…' : ACTIONS[action].confirm}
              </button>
            </>
          }
        >
          {action !== 'reactivate' ? (
            <BlockingEffects user={user} activity={activity} permanent={action === 'delete'} />
          ) : (
            <p>
              L'utilisateur pourra de nouveau se connecter
              {user.email_verified ? '.' : ', mais devra encore vérifier son adresse e-mail.'}
            </p>
          )}
          <label htmlFor="status-reason" className="mt-4 mb-1 block font-medium text-ink">
            Motif ({MIN_REASON} caractères au moins)
          </label>
          <textarea id="status-reason" rows={3} maxLength={1000} className="input" value={reason} onChange={(event) => setReason(event.target.value)} />
          {actionError && (
            <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-danger">
              {actionError}
            </p>
          )}
        </Modal>
      )}
    </>
  )
}
