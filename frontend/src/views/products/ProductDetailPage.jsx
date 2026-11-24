import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { fetchProduct } from '@/api/products'
import { createBuyerOrder } from '@/api/orders'
import ContactButton from '@/components/ContactButton'
import { selectIsAuthenticated, selectRole, useAuthStore } from '@/stores/auth'
import { loginPath, orderTrackingPath } from '@/router/paths'
import { ROLES } from '@/utils/roles'

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const role = useAuthStore(selectRole)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [product, setProduct] = useState(null)
  const [sameSupplierProducts, setSameSupplierProducts] = useState([])

  // Quantité du produit principal
  const [mainQuantity, setMainQuantity] = useState(1)

  // Produits additionnels sélectionnés du même fournisseur: { [productId]: quantity }
  const [selectedAddons, setSelectedAddons] = useState({})

  // Modale de récapitulatif de commande
  const [summaryModalOpen, setSummaryModalOpen] = useState(false)
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderError, setOrderError] = useState(null)

  const loadProductData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProduct(id)
      setProduct(data)
      setSameSupplierProducts(data.same_supplier_products ?? [])

      // Vérifier si une commande en attente était mémorisée avant connexion
      const pendingRaw = sessionStorage.getItem('pending_direct_order')
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw)
          if (String(pending.mainProductId) === String(id)) {
            setMainQuantity(pending.mainQuantity || 1)
            setSelectedAddons(pending.addons || {})
            // Si l'utilisateur est maintenant connecté, ouvrir le récapitulatif
            if (isAuthenticated && role === ROLES.BUYER) {
              setSummaryModalOpen(true)
            }
          }
        } catch {
          sessionStorage.removeItem('pending_direct_order')
        }
      }
    } catch (err) {
      setError(err.userMessage ?? 'Impossible de charger la fiche produit.')
    } finally {
      setLoading(false)
    }
  }, [id, isAuthenticated, role])

  useEffect(() => {
    loadProductData()
  }, [loadProductData])

  // Ajustement de la quantité principale
  const handleMainQuantityChange = (delta) => {
    setMainQuantity((current) => {
      const max = product?.stock !== null && product?.stock !== undefined ? product.stock : 9999
      const next = current + delta
      if (next < 1) return 1
      if (next > max) return max
      return next
    })
  }

  // Sélection / modification d'un produit additionnel du même fournisseur
  const toggleAddon = (addon) => {
    setSelectedAddons((prev) => {
      const next = { ...prev }
      if (next[addon.id]) {
        delete next[addon.id]
      } else {
        next[addon.id] = 1
      }
      return next
    })
  }

  const changeAddonQuantity = (addonId, delta, maxStock) => {
    setSelectedAddons((prev) => {
      const current = prev[addonId] || 1
      const max = maxStock !== null && maxStock !== undefined ? maxStock : 9999
      const next = current + delta
      if (next < 1) return prev
      if (next > max) return { ...prev, [addonId]: max }
      return { ...prev, [addonId]: next }
    })
  }

  // Calcul du panier / commande directe
  const orderItemsList = useMemo(() => {
    if (!product) return []
    const items = [
      {
        product_id: product.id,
        title: product.title,
        price: Number(product.price),
        quantity: mainQuantity,
        stock: product.stock,
      },
    ]

    sameSupplierProducts.forEach((addon) => {
      if (selectedAddons[addon.id]) {
        items.push({
          product_id: addon.id,
          title: addon.title,
          price: Number(addon.price),
          quantity: selectedAddons[addon.id],
          stock: addon.stock,
        })
      }
    })

    return items
  }, [product, mainQuantity, sameSupplierProducts, selectedAddons])

  const totalAmount = useMemo(() => {
    return orderItemsList.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [orderItemsList])

  // Clic sur « Commander »
  const handleInitiateOrder = () => {
    setOrderError(null)

    // Si non connecté, enregistrer l'intention et rediriger vers la connexion
    if (!isAuthenticated) {
      sessionStorage.setItem(
        'pending_direct_order',
        JSON.stringify({
          mainProductId: product.id,
          mainQuantity,
          addons: selectedAddons,
        }),
      )
      navigate(loginPath(`/produits/${product.id}?resume=1`))
      return
    }

    if (role === ROLES.SUPPLIER) {
      setOrderError('Seuls les porteurs de projet (acheteurs) peuvent passer une commande directe.')
      return
    }

    setSummaryModalOpen(true)
  }

  // Validation finale de la commande
  const handleConfirmOrder = async () => {
    setOrderSubmitting(true)
    setOrderError(null)

    try {
      const payload = {
        items: orderItemsList.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      }

      const res = await createBuyerOrder(payload)
      sessionStorage.removeItem('pending_direct_order')
      setSummaryModalOpen(false)

      const orderId = res.order?.id
      navigate(orderTrackingPath(orderId))
    } catch (err) {
      setOrderError(err.response?.data?.message ?? err.userMessage ?? 'Échec lors de la création de la commande.')
      setOrderSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl py-12 text-center text-slate-500">
        <p>Chargement de la fiche produit...</p>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-5xl py-12">
        <div className="card text-center text-rose-700 bg-rose-50 border-rose-200">
          <p className="font-semibold">{error ?? 'Produit introuvable.'}</p>
          <Link to="/" className="btn btn-secondary mt-4 inline-block">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    )
  }

  const supplier = product.supplier
  const isOutOfStock = product.stock !== null && product.stock <= 0

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="text-sm text-slate-500">
        <Link to="/" className="hover:text-slate-800">Catalogue</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-800 font-medium">{product.title}</span>
      </nav>

      {/* Détail produit & Fournisseur */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Colonne Principale : Infos Produit */}
        <div className="md:col-span-2 space-y-6">
          <div className="card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-block rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                  {product.category?.name ?? 'Catalogue'}
                </span>
                <h1 className="mt-2 text-2xl font-bold text-slate-900">{product.title}</h1>
              </div>
              <div className="text-right">
                <p className="text-3xl font-extrabold text-brand-600">
                  {Number(product.price).toFixed(2)} <span className="text-sm font-normal text-slate-600">TND / {product.unit || 'unité'}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">Prix unitaire direct fournisseur</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Description du produit</h3>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
                {product.description || 'Aucune description détaillée fournie.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-xs text-slate-600">
              <div>
                <span className="font-semibold text-slate-700">Disponibilité : </span>
                {isOutOfStock ? (
                  <span className="text-rose-600 font-semibold">Rupture de stock</span>
                ) : (
                  <span className="text-emerald-600 font-semibold">
                    En stock ({product.stock !== null ? `${product.stock} unités` : 'disponible'})
                  </span>
                )}
              </div>
              {product.availability_days && (
                <div>
                  <span className="font-semibold text-slate-700">Délai indicatif : </span>
                  {product.availability_days} jour(s)
                </div>
              )}
            </div>
          </div>

          {/* Produits du même fournisseur (commande directe multi-articles sans panier) */}
          {sameSupplierProducts.length > 0 && (
            <div className="card space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Complétez votre commande directe auprès de {supplier?.company_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Ajoutez d'autres articles du même fournisseur à votre commande sans passer par un panier multi-vendeurs.
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {sameSupplierProducts.map((addon) => {
                  const isSelected = Boolean(selectedAddons[addon.id])
                  const addonStockZero = addon.stock !== null && addon.stock <= 0

                  return (
                    <div key={addon.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`addon-${addon.id}`}
                          checked={isSelected}
                          disabled={addonStockZero}
                          onChange={() => toggleAddon(addon)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <label htmlFor={`addon-${addon.id}`} className="cursor-pointer">
                          <p className="text-sm font-medium text-slate-800">{addon.title}</p>
                          <p className="text-xs text-slate-500">
                            {Number(addon.price).toFixed(2)} TND {addon.unit ? `/ ${addon.unit}` : ''}
                            {addon.stock !== null ? ` • Stock: ${addon.stock}` : ''}
                          </p>
                        </label>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => changeAddonQuantity(addon.id, -1, addon.stock)}
                            className="h-7 w-7 rounded border border-slate-200 text-sm font-semibold hover:bg-slate-100"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm font-semibold">
                            {selectedAddons[addon.id]}
                          </span>
                          <button
                            type="button"
                            onClick={() => changeAddonQuantity(addon.id, 1, addon.stock)}
                            className="h-7 w-7 rounded border border-slate-200 text-sm font-semibold hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Colonne Latérale : Action Commande Directe & Fournisseur */}
        <div className="space-y-6">
          {/* Bloc Commande */}
          <div className="card space-y-5 border-2 border-brand-100 bg-brand-50/20 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Commander directement</h2>

            {/* Sélecteur de quantité pour le produit principal */}
            <div>
              <label htmlFor="main-quantity-input" className="block text-xs font-semibold text-slate-700 uppercase">Quantité</label>
              <div className="mt-1.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleMainQuantityChange(-1)}
                  disabled={mainQuantity <= 1 || isOutOfStock}
                  className="h-9 w-9 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  -
                </button>
                <input
                  id="main-quantity-input"
                  type="number"
                  min="1"
                  max={product.stock ?? 9999}
                  value={mainQuantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val) && val >= 1) {
                      const max = product.stock !== null ? product.stock : 9999
                      setMainQuantity(Math.min(val, max))
                    }
                  }}
                  disabled={isOutOfStock}
                  className="h-9 w-20 rounded-lg border border-slate-200 bg-white text-center font-semibold text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => handleMainQuantityChange(1)}
                  disabled={(product.stock !== null && mainQuantity >= product.stock) || isOutOfStock}
                  className="h-9 w-9 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  +
                </button>
                <span className="text-xs text-slate-500">{product.unit || 'unité(s)'}</span>
              </div>
            </div>

            {/* Total estimé */}
            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-600">Total estimé :</span>
                <span className="text-xl font-black text-slate-900">
                  {totalAmount.toFixed(2)} <span className="text-xs font-normal">TND</span>
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {orderItemsList.length > 1 ? `${orderItemsList.length} articles sélectionnés` : '1 article'}
              </p>
            </div>

            {orderError && (
              <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                {orderError}
              </div>
            )}

            <button
              type="button"
              onClick={handleInitiateOrder}
              disabled={isOutOfStock}
              className="btn btn-primary w-full py-3 text-base font-semibold shadow-md disabled:opacity-50"
            >
              Commander
            </button>

            <p className="text-center text-[11px] text-slate-500">
              Règlement direct auprès du fournisseur (sans paiement en ligne).
            </p>
          </div>

          {/* Bloc Vendeur */}
          {supplier && (
            <div className="card space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Fournisseur vérifié</h3>
              <div className="flex items-center gap-3">
                {supplier.logo_url ? (
                  <img src={supplier.logo_url} alt={supplier.company_name} className="h-10 w-10 rounded-full object-cover border" />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">
                    {supplier.company_name?.charAt(0) || 'F'}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-900">{supplier.company_name}</p>
                  <p className="text-xs text-emerald-600 font-medium">✓ Dossier fournisseur validé</p>
                  {Number(supplier.rating_avg) > 0 && (
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-amber-600 font-medium">
                      <span>★ {Number(supplier.rating_avg).toFixed(1)}/5</span>
                      <span className="text-slate-400">({supplier.reviews_count} avis)</span>
                    </div>
                  )}
                </div>
              </div>

              <ContactButton
                supplierId={supplier.id}
                label="Contacter le fournisseur"
                draft={`Bonjour, je suis intéressé par « ${product.title} ».`}
              />

              {(supplier.delivery_days || supplier.payment_terms) && (
                <div className="border-t border-slate-100 pt-2 text-xs space-y-1 text-slate-600">
                  {supplier.delivery_days && (
                    <p>• Délais moyens : {supplier.delivery_days} jour(s)</p>
                  )}
                  {supplier.payment_terms && (
                    <p>• Conditions : {supplier.payment_terms}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modale Récapitulatif de Commande (SCRUM-51) */}
      {summaryModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="summary-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
            <div>
              <h2 id="summary-modal-title" className="text-xl font-bold text-slate-900">
                Récapitulatif de votre commande
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Fournisseur : <span className="font-semibold text-slate-800">{supplier?.company_name}</span>
              </p>
            </div>

            {/* Tableau des articles */}
            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-2 font-medium">Article</th>
                    <th className="pb-2 font-medium text-center">Qté</th>
                    <th className="pb-2 font-medium text-right">P.U.</th>
                    <th className="pb-2 font-medium text-right">Sous-total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderItemsList.map((item) => (
                    <tr key={item.product_id} className="text-slate-800">
                      <td className="py-2 font-medium pr-2">{item.title}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right">{item.price.toFixed(2)}</td>
                      <td className="py-2 text-right font-semibold">
                        {(item.price * item.quantity).toFixed(2)} TND
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm font-semibold text-slate-700">Total à régler au fournisseur :</span>
              <span className="text-2xl font-black text-brand-600">
                {totalAmount.toFixed(2)} <span className="text-xs font-normal">TND</span>
              </span>
            </div>

            {/* Mention OBLIGATOIRE du cahier des charges */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">⚠️ Modalités de règlement :</p>
              <p className="mt-0.5">
                Aucun paiement en ligne — règlement selon les conditions du fournisseur (à la livraison ou par virement bancaire).
              </p>
            </div>

            {orderError && (
              <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                {orderError}
              </div>
            )}

            {/* Boutons d'action */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSummaryModalOpen(false)}
                disabled={orderSubmitting}
                className="btn btn-secondary text-sm"
              >
                Modifier ma sélection
              </button>
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={orderSubmitting}
                className="btn btn-primary text-sm shadow-sm"
              >
                {orderSubmitting ? 'Validation...' : 'Confirmer la commande'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
