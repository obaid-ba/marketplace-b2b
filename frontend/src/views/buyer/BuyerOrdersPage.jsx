import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchBuyerOrders, fetchOrderDocumentBlob } from '@/api/orders'
import { OrderStatusBadge, OrderStatusProgress } from '@/components/orders/OrderStatusBadge'
import { orderTrackingPath } from '@/router/paths'

const TABS = [
  { key: 'all', label: 'Toutes' },
  { key: 'validée', label: 'Validée' },
  { key: 'expédiée', label: 'Expédiée' },
  { key: 'livrée', label: 'Livrée' },
  { key: 'clôturée', label: 'Clôturée' },
]

export default function BuyerOrdersPage() {
  const [orders, setOrders] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloadingDocId, setDownloadingDocId] = useState(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchBuyerOrders(activeTab, currentPage)
      setOrders(data.data ?? [])
      setCurrentPage(data.current_page ?? 1)
      setLastPage(data.last_page ?? 1)
      setTotal(data.total ?? 0)
    } catch (err) {
      setError(err.userMessage ?? 'Impossible de charger vos commandes.')
    } finally {
      setLoading(false)
    }
  }, [activeTab, currentPage])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const handleTabChange = (key) => {
    setActiveTab(key)
    setCurrentPage(1)
  }

  const handleDownloadDocument = async (orderId, doc) => {
    setDownloadingDocId(doc.id)
    try {
      const blob = await fetchOrderDocumentBlob(orderId, doc.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.type}_${doc.number}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Impossible de télécharger le document.')
    } finally {
      setDownloadingDocId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mes commandes</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Suivez l'état d'avancement et téléchargez les documents de vos commandes passées.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {total} commande{total > 1 ? 's' : ''} au total
        </span>
      </div>

      {/* Onglets de filtrage */}
      <div className="flex overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'border-brand-600 text-brand-600 font-semibold'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="card py-12 text-center text-slate-500">
          <p>Chargement de vos commandes...</p>
        </div>
      ) : error ? (
        <div className="card py-8 text-center text-rose-700 bg-rose-50 border-rose-200">
          <p>{error}</p>
          <button type="button" onClick={loadOrders} className="btn btn-secondary mt-3">
            Réessayer
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="card py-12 text-center text-slate-500">
          <p className="font-medium text-slate-700">Aucune commande trouvée</p>
          <p className="mt-1 text-xs">
            {activeTab === 'all'
              ? 'Vous n’avez pas encore passé de commande directe.'
              : `Aucune commande avec le statut « ${activeTab} ».`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const supplier = order.supplier
            const items = order.items ?? []
            const docs = order.documents ?? []
            const formattedDate = new Date(order.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })

            return (
              <div key={order.id} className="card space-y-4 transition hover:shadow-md">
                {/* Ligne d'en-tête de la commande */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono font-bold text-base text-slate-900">
                      Commande #{order.id}
                    </span>
                    <span className="text-xs text-slate-500">du {formattedDate}</span>
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium uppercase ${
                        order.origin === 'catalogue' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                      }`}
                    >
                      {order.origin}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-black text-slate-900">
                      {Number(order.total).toFixed(2)} <span className="text-xs font-normal">TND</span>
                    </span>
                  </div>
                </div>

                {/* Fournisseur & Articles */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Fournisseur</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {supplier?.company_name || 'Fournisseur'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {items.length} article{items.length > 1 ? 's' : ''} commandé{items.length > 1 ? 's' : ''} :
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {items.slice(0, 3).map((item) => (
                        <li key={item.id} className="truncate">
                          • {item.label} (x{item.quantity}) - {Number(item.unit_price).toFixed(2)} TND
                        </li>
                      ))}
                      {items.length > 3 && (
                        <li className="text-slate-400 italic">
                          + {items.length - 3} autre{items.length - 3 > 1 ? 's' : ''} article{items.length - 3 > 1 ? 's' : ''}...
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Documents attachés (devis, facture) */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Documents</p>
                    {docs.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-400 italic">Aucun document émis pour le moment</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {docs.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => handleDownloadDocument(order.id, doc)}
                            disabled={downloadingDocId === doc.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {doc.type === 'devis' ? 'Devis' : 'Facture'} #{doc.number}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Barre de progression des 4 statuts */}
                <div className="border-t border-slate-100 pt-3">
                  <OrderStatusProgress status={order.status} />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                  <Link
                    to={orderTrackingPath(order.id)}
                    className="btn btn-secondary text-xs font-semibold py-1.5"
                  >
                    Suivre la commande →
                  </Link>
                </div>
              </div>
            )
          })}

          {/* Pagination */}
          {lastPage > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="btn btn-secondary text-xs disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="text-xs text-slate-500 self-center">
                Page {currentPage} sur {lastPage}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(lastPage, p + 1))}
                disabled={currentPage >= lastPage}
                className="btn btn-secondary text-xs disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
