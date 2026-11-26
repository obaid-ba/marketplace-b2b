import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { downloadTenderAttachment } from '@/api/attachments'
import { fetchSupplierTender, submitTenderQuote } from '@/api/supplierTenders'
import ContactButton from '@/components/ContactButton'
import PageHeader from '@/components/PageHeader'
import RelevanceScoreBadge from '@/components/RelevanceScoreBadge'
import { QuoteStatusBadge, TenderStatusBadge } from '@/components/TenderBadges'
import { PATHS } from '@/router/paths'
import { formatAmount } from '@/utils/money'
import { formatDate } from '@/utils/period'
import { useFormDraft } from '@/utils/useFormDraft'

const EMPTY_QUOTE = { amount: '', delivery_days: '', conditions: '', comment: '' }

function formFromQuote(quote) {
  if (!quote) return EMPTY_QUOTE
  return {
    amount: String(quote.amount ?? ''),
    delivery_days: String(quote.delivery_days ?? ''),
    conditions: quote.conditions ?? '',
    comment: quote.comment ?? '',
  }
}

/**
 * Détail d'une demande reçue et envoi du devis unique (SCRUM-44, SCRUM-45 / F13).
 * Un seul devis par demande, modifiable tant qu'il n'est pas accepté.
 */
export default function ReceivedTenderDetailPage() {
  const { id } = useParams()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState(EMPTY_QUOTE)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  // Devis en cours de saisie conservé en cas de coupure réseau (SCRUM-92), restauré une fois la demande chargée.
  const draft = useFormDraft(`quote:${id}`, form, setForm, { ready: detail !== null })

  useEffect(() => {
    let active = true

    setLoading(true)
    fetchSupplierTender(id)
      .then((data) => {
        if (!active) return
        setDetail(data)
        setForm(formFromQuote(data.my_quote))
      })
      .catch((failure) => {
        if (active) setError(failure.userMessage ?? 'Impossible de charger cette demande.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      const quote = await submitTenderQuote(
        id,
        {
          amount: form.amount,
          delivery_days: form.delivery_days,
          conditions: form.conditions || null,
          comment: form.comment || null,
        },
        Boolean(detail.my_quote),
      )

      draft.clear()
      setDetail((current) => ({ ...current, my_quote: quote, already_responded: true }))
      setForm(formFromQuote(quote))
      setNotice(
        detail.my_quote
          ? 'Votre devis a été mis à jour. Le porteur de projet est prévenu.'
          : 'Votre devis est envoyé. Le porteur de projet est prévenu.',
      )
    } catch (failure) {
      setError(failure.userMessage ?? 'Le devis n’a pas pu être envoyé.')
      setFieldErrors(failure.fieldErrors ?? {})
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAttachment(attachment) {
    try {
      await downloadTenderAttachment(id, attachment, 'supplier')
    } catch (failure) {
      setError(failure.userMessage ?? 'La pièce jointe n’a pas pu être téléchargée.')
    }
  }

  if (loading) return <div className="card text-sm text-muted">Chargement de la demande…</div>

  if (error && !detail) {
    return (
      <div className="card border-danger-soft bg-danger-soft/40 text-sm text-danger">
        {error}
        <Link to={PATHS.supplierTenders} className="btn-secondary ml-4">
          Demandes reçues
        </Link>
      </div>
    )
  }

  if (!detail?.tender) return null

  const tender = detail.tender
  const quote = detail.my_quote
  const tenderOpen = ['ouverte', 'en négociation'].includes(tender.status)
  const canSubmit = tenderOpen && quote?.status !== 'accepté'

  return (
    <>
      <PageHeader
        title={tender.title}
        subtitle={`${tender.category?.name ?? 'Catégorie non précisée'} · ${tender.region?.name ?? 'Toute la Tunisie'}`}
        actions={
          <>
            <ContactButton contextType="demande" contextId={tender.id} label="Contacter le porteur" className="btn-primary" />
            <Link to={PATHS.supplierTenders} className="btn-secondary">
              Demandes reçues
            </Link>
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
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <RelevanceScoreBadge score={detail.score} />
              <TenderStatusBadge status={tender.status} label={tender.status_label} />
              <span className="rounded-full bg-page px-2.5 py-0.5 text-xs font-medium text-muted">
                Reçue le {formatDate(detail.notified_at?.slice(0, 10))}
              </span>
            </div>

            <h2 className="text-sm font-semibold text-ink">Description du besoin</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted">{tender.description}</p>

            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-muted">Budget indicatif</dt>
                <dd className="font-medium text-ink">
                  {tender.budget !== null ? formatAmount(tender.budget) : 'Non précisé'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-muted">Date limite</dt>
                <dd className="font-medium text-ink">
                  {tender.desired_deadline ? formatDate(tender.desired_deadline) : 'Non précisée'}
                </dd>
              </div>
              {tender.buyer && (
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted">Porteur de projet</dt>
                  <dd className="font-medium text-ink">{tender.buyer.organization || tender.buyer.name}</dd>
                </div>
              )}
            </dl>
          </section>

          {(tender.attachments ?? []).length > 0 && (
            <section className="card">
              <h2 className="text-sm font-semibold text-ink">Pièces jointes</h2>
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
            </section>
          )}

          <section className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">
                {quote ? 'Mon devis' : 'Envoyer un devis'}
              </h2>
              {quote && <QuoteStatusBadge status={quote.status} label={quote.status_label} />}
            </div>

            {!tenderOpen && (
              <p className="mt-2 rounded-lg bg-page px-3 py-2 text-sm text-muted">
                Cette demande est {tender.status_label?.toLowerCase() ?? 'clôturée'} : le devis ne peut plus être modifié.
              </p>
            )}

            {quote?.status === 'accepté' && (
              <p className="mt-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
                Votre devis a été accepté : la commande a été créée par le porteur de projet.
              </p>
            )}

            {canSubmit && (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="amount" className="mb-1 block text-sm font-medium text-ink">
                      Montant proposé (TND) *
                    </label>
                    <input
                      id="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="input"
                      value={form.amount}
                      onChange={(event) => update('amount', event.target.value)}
                      required
                    />
                    {fieldErrors.amount && <p className="mt-1 text-sm text-danger">{fieldErrors.amount[0]}</p>}
                  </div>

                  <div>
                    <label htmlFor="delivery_days" className="mb-1 block text-sm font-medium text-ink">
                      Délai de livraison (jours) *
                    </label>
                    <input
                      id="delivery_days"
                      type="number"
                      min="1"
                      max="365"
                      className="input"
                      value={form.delivery_days}
                      onChange={(event) => update('delivery_days', event.target.value)}
                      required
                    />
                    {fieldErrors.delivery_days && (
                      <p className="mt-1 text-sm text-danger">{fieldErrors.delivery_days[0]}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="conditions" className="mb-1 block text-sm font-medium text-ink">
                    Conditions
                  </label>
                  <textarea
                    id="conditions"
                    className="input min-h-20"
                    value={form.conditions}
                    onChange={(event) => update('conditions', event.target.value)}
                    placeholder="Paiement, livraison, garantie…"
                    maxLength={2000}
                  />
                  {fieldErrors.conditions && <p className="mt-1 text-sm text-danger">{fieldErrors.conditions[0]}</p>}
                </div>

                <div>
                  <label htmlFor="comment" className="mb-1 block text-sm font-medium text-ink">
                    Message au porteur
                  </label>
                  <textarea
                    id="comment"
                    className="input min-h-20"
                    value={form.comment}
                    onChange={(event) => update('comment', event.target.value)}
                    placeholder="Précisions sur votre proposition…"
                    maxLength={2000}
                  />
                  {fieldErrors.comment && <p className="mt-1 text-sm text-danger">{fieldErrors.comment[0]}</p>}
                </div>

                <div className="flex justify-end border-t border-line pt-4">
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Envoi…' : quote ? 'Mettre à jour le devis' : 'Envoyer le devis'}
                  </button>
                </div>
              </form>
            )}

            {!quote && !tenderOpen && (
              <p className="mt-3 text-sm text-muted">Vous n’avez pas envoyé de devis pour cette demande.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card">
            <h2 className="text-sm font-semibold text-ink">Pourquoi cette demande ?</h2>
            <p className="mt-2 text-sm text-muted">
              Le score de pertinence combine la catégorie du besoin, la région souhaitée et les
              mots-clés de votre activité.
            </p>
            <div className="mt-3">
              <RelevanceScoreBadge score={detail.score} />
            </div>
            <p className="mt-3 text-xs text-muted">
              Source : {detail.source ?? 'diffusion automatique'}
            </p>
          </section>

          {quote && (
            <section className="card">
              <h2 className="text-sm font-semibold text-ink">Résumé du devis</h2>
              <p className="mt-2 text-xl font-semibold text-ink">{formatAmount(quote.amount)}</p>
              <p className="text-sm text-muted">{quote.delivery_days} jour(s) de délai</p>
              <p className="mt-2 text-xs text-muted">
                Envoyé le {formatDate(quote.updated_at?.slice(0, 10) ?? quote.created_at?.slice(0, 10))}
              </p>
            </section>
          )}
        </aside>
      </div>
    </>
  )
}
