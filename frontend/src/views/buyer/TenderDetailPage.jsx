import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { downloadTenderAttachment } from '@/api/attachments'
import { cancelTender, fetchBuyerTender, fetchFavoriteSuppliers, inviteSupplier } from '@/api/tenders'
import PageHeader from '@/components/PageHeader'
import { TenderStatusBadge } from '@/components/TenderBadges'
import { buyerTenderPath, buyerTenderQuotesPath, PATHS } from '@/router/paths'
import { formatAmount } from '@/utils/money'
import { formatDate } from '@/utils/period'

/**
 * Détail d'une demande côté porteur (SCRUM-43 / F11) : suivi de la diffusion,
 * invitation d'un fournisseur favori et annulation.
 */
export default function TenderDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const [tender, setTender] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(location.state?.notice ?? null)
  const [acting, setActing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [detail, favoriteList] = await Promise.all([
        fetchBuyerTender(id),
        fetchFavoriteSuppliers(id).catch(() => []),
      ])
      setTender(detail)
      setFavorites(Array.isArray(favoriteList) ? favoriteList : (favoriteList.data ?? []))
    } catch (failure) {
      setError(failure.userMessage ?? 'Impossible de charger cette demande.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleCancel() {
    if (!window.confirm('Annuler cette demande ? Les fournisseurs ayant répondu seront prévenus.')) return

    setActing('cancel')
    setError(null)
    try {
      const updated = await cancelTender(id)
      setTender(updated)
      setNotice('La demande est annulée.')
    } catch (failure) {
      setError(failure.userMessage ?? 'L’annulation a échoué.')
    } finally {
      setActing(null)
    }
  }

  async function handleInvite(supplier) {
    setActing(`invite-${supplier.id}`)
    setError(null)
    try {
      await inviteSupplier(id, supplier.id)
      setFavorites((current) =>
        current.map((entry) => (entry.id === supplier.id ? { ...entry, invited: true } : entry)),
      )
      setTender((current) =>
        current
          ? {
              ...current,
              recipients_count: (current.recipients_count ?? 0) + 1,
              notified_count: (current.notified_count ?? 0) + 1,
            }
          : current,
      )
      setNotice(`${supplier.company_name} a été invité et notifié.`)
    } catch (failure) {
      setError(failure.userMessage ?? 'L’invitation a échoué.')
    } finally {
      setActing(null)
    }
  }

  async function handleAttachment(attachment) {
    try {
      await downloadTenderAttachment(id, attachment, 'buyer')
    } catch (failure) {
      setError(failure.userMessage ?? 'La pièce jointe n’a pas pu être téléchargée.')
    }
  }

  if (loading) return <div className="card text-sm text-muted">Chargement de la demande…</div>

  if (error && !tender) {
    return (
      <div className="card border-danger-soft bg-danger-soft/40 text-sm text-danger">
        {error}
        <Link to={PATHS.buyerTenders} className="btn-secondary ml-4">
          Retour
        </Link>
      </div>
    )
  }

  if (!tender) return null

  const isOpen = ['ouverte', 'en négociation'].includes(tender.status)

  return (
    <>
      <PageHeader
        title={tender.title}
        subtitle={`Publiée le ${formatDate(tender.created_at?.slice(0, 10))}`}
        actions={
          <>
            <Link to={PATHS.buyerTenders} className="btn-secondary">
              Mes demandes
            </Link>
            {(tender.quotes_count ?? 0) > 0 && (
              <Link to={buyerTenderQuotesPath(tender.id)} className="btn-primary">
                Comparer les devis ({tender.quotes_count})
              </Link>
            )}
          </>
        }
      />

      {notice && (
        <div className="mb-4 rounded-lg border border-success-soft bg-success-soft/60 px-4 py-3 text-sm text-success">
          {notice}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-danger-soft bg-danger-soft/50 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <TenderStatusBadge status={tender.status} label={tender.status_label} />
              {tender.category && (
                <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-medium text-info">
                  {tender.category.name}
                </span>
              )}
              <span className="rounded-full bg-page px-2.5 py-0.5 text-xs font-medium text-muted">
                {tender.region?.name ?? 'Toute la Tunisie'}
              </span>
            </div>

            <h2 className="text-sm font-semibold text-ink">Description du besoin</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted">{tender.description}</p>
          </section>

          <section className="card">
            <h2 className="text-sm font-semibold text-ink">Pièces jointes</h2>
            {(tender.attachments ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted">Aucune pièce jointe.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {tender.attachments.map((attachment) => (
                  <li key={attachment.id} className="flex items-center justify-between rounded-lg bg-page px-3 py-2">
                    <span className="truncate text-sm text-ink">{attachment.name}</span>
                    <button
                      type="button"
                      className="ml-3 text-sm font-medium text-brand-600 hover:underline"
                      onClick={() => handleAttachment(attachment)}
                    >
                      Télécharger
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="text-sm font-semibold text-ink">Fournisseurs favoris</h2>
            <p className="mt-1 text-sm text-muted">
              Invitez un fournisseur de confiance à répondre à cette demande.
            </p>

            {favorites.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Aucun fournisseur favori pour le moment. Ajoutez-en depuis la fiche d’un fournisseur.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {favorites.map((supplier) => (
                  <li key={supplier.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{supplier.company_name}</p>
                      <p className="text-xs text-muted">
                        {supplier.region?.name ?? 'Région non renseignée'}
                        {supplier.rating_avg > 0 && ` · ${supplier.rating_avg.toFixed(1)} / 5`}
                      </p>
                    </div>

                    {supplier.invited ? (
                      <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success">
                        {supplier.responded ? 'A répondu' : 'Invité'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={!isOpen || acting === `invite-${supplier.id}`}
                        onClick={() => handleInvite(supplier)}
                      >
                        {acting === `invite-${supplier.id}` ? 'Invitation…' : 'Inviter'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card">
            <h2 className="text-sm font-semibold text-ink">Résumé</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Budget</dt>
                <dd className="font-medium text-ink">
                  {tender.budget !== null ? formatAmount(tender.budget) : 'Non précisé'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Date limite</dt>
                <dd className="font-medium text-ink">
                  {tender.desired_deadline ? formatDate(tender.desired_deadline) : 'Non précisée'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Fournisseurs notifiés</dt>
                <dd className="font-medium text-ink">{tender.notified_count ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Devis reçus</dt>
                <dd className="font-medium text-ink">{tender.quotes_count ?? 0}</dd>
              </div>
            </dl>

            <Link
              to={buyerTenderQuotesPath(tender.id)}
              className="btn-secondary mt-4 w-full"
            >
              Voir les devis
            </Link>
          </section>

          {isOpen && (
            <section className="card">
              <h2 className="text-sm font-semibold text-ink">Annuler la demande</h2>
              <p className="mt-1 text-sm text-muted">
                Les fournisseurs ayant déjà répondu seront notifiés. Cette action est définitive.
              </p>
              <button
                type="button"
                className="btn-secondary mt-3 w-full border-danger-soft text-danger hover:bg-danger-soft/40"
                disabled={acting === 'cancel'}
                onClick={handleCancel}
              >
                {acting === 'cancel' ? 'Annulation…' : 'Annuler la demande'}
              </button>
            </section>
          )}
        </aside>
      </div>
    </>
  )
}
