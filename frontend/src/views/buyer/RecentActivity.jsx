import { Link } from 'react-router'
import EmptyState from '@/components/dashboard/EmptyState'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { TenderStatusBadge } from '@/components/TenderBadges'
import { buyerTenderPath, buyerTenderQuotesPath, orderTrackingPath } from '@/router/paths'
import { formatAmount } from '@/utils/money'

const MAX_ITEMS = 5

const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

const STEPS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** « il y a 2 heures », « hier »… à partir d'une date ISO. */
export function timeAgo(value, now = Date.now()) {
  const seconds = (new Date(value).getTime() - now) / 1000
  if (Number.isNaN(seconds)) return ''
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'à l’instant'
}

const TONES = {
  order: 'bg-[#dcf5ea] text-[#12a06b]',
  quote: 'bg-[#ece9fe] text-[#5b4bdb]',
  tender: 'bg-[#e2efff] text-[#2f6fe4]',
}

const PATHS = {
  order: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01',
  quote: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4',
  tender: 'M18 4v13l-6-3H8a3 3 0 0 1 0-6h4zM9 14l1.5 5',
}

function ActivityIcon({ kind }) {
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${TONES[kind]}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <path d={PATHS[kind]} />
      </svg>
    </span>
  )
}

/** Commandes, devis reçus et demandes publiées, du plus récent au plus ancien. */
function activities({ orders, quotes, requests }) {
  return [
    ...orders.map((order) => ({
      key: `order-${order.id}`,
      kind: 'order',
      date: order.created_at,
      title: `Commande #${order.id}`,
      detail: `${order.supplier ?? 'Fournisseur'} · ${formatAmount(order.total)}`,
      to: orderTrackingPath(order.id),
      badge: <OrderStatusBadge status={order.status} />,
    })),
    ...quotes.map((quote) => ({
      key: `quote-${quote.id}`,
      kind: 'quote',
      date: quote.received_at,
      title: `Devis reçu de ${quote.supplier ?? 'un fournisseur'}`,
      detail: `${quote.tender ?? 'Demande'} · ${formatAmount(quote.amount)}`,
      to: buyerTenderQuotesPath(quote.tender_id),
      badge: <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">En attente</span>,
    })),
    ...requests.map((tender) => ({
      key: `tender-${tender.id}`,
      kind: 'tender',
      date: tender.created_at,
      title: 'Nouvelle demande de devis',
      detail: tender.title,
      to: buyerTenderPath(tender.id),
      badge: <TenderStatusBadge status={tender.status} label={tender.status_label} />,
    })),
  ]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, MAX_ITEMS)
}

export default function RecentActivity({ orders = [], quotes = [], requests = [], allPath }) {
  const items = activities({ orders, quotes, requests })

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm" aria-labelledby="recent-activity-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-activity-title" className="flex items-center gap-2 text-base font-semibold text-ink">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 text-brand-600" aria-hidden="true">
            <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5M3.5 4v4.5H8M12 8v4l3 2" />
          </svg>
          Dernières activités
        </h2>
        {allPath && (
          <Link to={allPath} className="text-sm font-medium text-brand-600 hover:underline">
            Voir tout →
          </Link>
        )}
      </div>

      {items.length ? (
        <ul className="mt-4 space-y-1">
          {items.map((item) => (
            <li key={item.key}>
              <Link to={item.to} className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-page">
                <ActivityIcon kind={item.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {timeAgo(item.date)} · {item.detail}
                  </span>
                </span>
                <span className="shrink-0">{item.badge}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <EmptyState title="Aucune activité récente" description="Vos commandes, devis et demandes apparaîtront ici." />
        </div>
      )}
    </section>
  )
}
