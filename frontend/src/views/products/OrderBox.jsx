import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { createBuyerOrder } from '@/api/orders'
import ContactButton from '@/components/ContactButton'
import FavoriteButton from '@/components/FavoriteButton'
import Modal from '@/components/Modal'
import { loginPath, orderTrackingPath } from '@/router/paths'
import { selectRole, useAuthStore } from '@/stores/auth'
import { formatNumber, formatPrice, pluralize } from '@/utils/format'
import { ROLES } from '@/utils/roles'

const PENDING_KEY = 'pending_direct_order'

/** Sélection mémorisée avant la connexion, si elle concerne ce produit. */
function readPending(productId) {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY))
    return pending && String(pending.mainProductId) === String(productId) ? pending : null
  } catch {
    return null
  }
}

function savePending(pending) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {
    /* stockage indisponible : la sélection sera à refaire après la connexion */
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignoré */
  }
}

/** stock null : service ou stock non suivi, donc pas de maximum. */
function isValidQuantity(value, stock) {
  const quantity = Number(value)
  return Number.isInteger(quantity) && quantity >= 1 && (stock == null || quantity <= stock)
}

function QuantityField({ id, label, hideLabel = false, value, stock, disabled, onChange }) {
  const invalid = !disabled && !isValidQuantity(value, stock)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-[13px] font-medium text-ink'}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="1"
        max={stock ?? undefined}
        step="1"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-28 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      {invalid && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {stock == null ? 'Choisissez une quantité d’au moins 1.' : `Choisissez une quantité entre 1 et ${formatNumber(stock)}.`}
        </p>
      )}
    </div>
  )
}

/**
 * Commande directe depuis la fiche produit (SCRUM-51) : quantité, autres produits du même fournisseur, récapitulatif.
 * Un visiteur se connecte puis retrouve sa sélection. Un fournisseur ou un administrateur ne voit pas ce bloc.
 */
export default function OrderBox({ product }) {
  const role = useAuthStore(selectRole)
  const navigate = useNavigate()
  const location = useLocation()
  const [restored] = useState(() => readPending(product.id))
  const [quantity, setQuantity] = useState(() => String(restored?.mainQuantity ?? 1))
  const [addons, setAddons] = useState(() => {
    const available = (product.same_supplier_products ?? []).filter((addon) => restored?.addons?.[addon.id])
    return Object.fromEntries(available.map((addon) => [addon.id, String(restored.addons[addon.id])]))
  })
  const [startOpen] = useState(() => Object.keys(addons).length > 0)
  const [summaryOpen, setSummaryOpen] = useState(() => Boolean(restored) && role === ROLES.BUYER)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // La sélection n'est reprise qu'une fois : elle ne doit pas rouvrir le récapitulatif à chaque visite.
  useEffect(() => {
    if (role === ROLES.BUYER) clearPending()
  }, [role])

  const others = product.same_supplier_products ?? []

  const items = useMemo(
    () => [
      { product_id: product.id, title: product.title, price: Number(product.price), quantity, stock: product.stock },
      ...(product.same_supplier_products ?? [])
        .filter((addon) => addon.id in addons)
        .map((addon) => ({ product_id: addon.id, title: addon.title, price: Number(addon.price), quantity: addons[addon.id], stock: addon.stock })),
    ],
    [addons, product, quantity],
  )

  if (role === ROLES.SUPPLIER || role === ROLES.ADMIN) return null

  const outOfStock = !product.in_stock
  const valid = !outOfStock && items.every((item) => isValidQuantity(item.quantity, item.stock))
  const total = valid ? items.reduce((sum, item) => sum + item.price * Number(item.quantity), 0) : null
  const { supplier } = product

  function toggleAddon(id) {
    setAddons(({ [id]: current, ...rest }) => (current === undefined ? { ...rest, [id]: '1' } : rest))
  }

  function order() {
    setError(null)
    if (!role) {
      savePending({
        mainProductId: product.id,
        mainQuantity: Number(quantity),
        addons: Object.fromEntries(Object.entries(addons).map(([id, value]) => [id, Number(value)])),
      })
      navigate(loginPath(location.pathname + location.search))
      return
    }
    setSummaryOpen(true)
  }

  async function confirm() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await createBuyerOrder({
        items: items.map((item) => ({ product_id: item.product_id, quantity: Number(item.quantity) })),
      })
      navigate(orderTrackingPath(result.order.id))
    } catch (err) {
      setError(err.response?.data?.message ?? err.userMessage ?? "La commande n'a pas pu être passée.")
      setSubmitting(false)
    }
  }

  function closeSummary() {
    if (submitting) return
    setSummaryOpen(false)
    setError(null)
  }

  return (
    <section aria-label="Commander" className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <QuantityField
          id="order-quantity"
          label={`Quantité${product.unit ? ` (${product.unit})` : ''}`}
          value={quantity}
          stock={product.stock}
          disabled={outOfStock}
          onChange={setQuantity}
        />
        <button type="button" className="btn-primary px-6 py-2.5 font-semibold" disabled={!valid} onClick={order}>
          Commander
        </button>
        <ContactButton
          supplierId={supplier.id}
          label="Contacter le fournisseur"
          draft={`Bonjour, je suis intéressé par « ${product.title} ».`}
          className="btn-secondary px-5 py-2.5 font-semibold"
        />
        <FavoriteButton supplierId={supplier.id} initialIsFavorite={supplier.is_favorite} label="Favori" />
      </div>

      {!outOfStock && others.length > 0 && (
        <details className="rounded-xl border border-line bg-surface px-4 py-3" open={startOpen}>
          <summary className="cursor-pointer text-[15px] font-medium text-ink">
            Ajouter d’autres produits de {supplier.company_name}
          </summary>
          <ul className="mt-2 divide-y divide-line">
            {others.map((addon) => {
              const selected = addon.id in addons
              const unavailable = addon.stock !== null && addon.stock <= 0
              return (
                <li key={addon.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <label className="flex min-w-0 flex-1 items-center gap-3 text-sm">
                    <input type="checkbox" className="accent-brand-600" checked={selected} disabled={unavailable} onChange={() => toggleAddon(addon.id)} />
                    <span className="min-w-0">
                      <span className="block text-ink">{addon.title}</span>
                      <span className="block text-xs text-muted">
                        {formatPrice(addon.price)}
                        {addon.unit && ` / ${addon.unit}`}
                        {unavailable && ' - rupture'}
                      </span>
                    </span>
                  </label>
                  {selected && (
                    <QuantityField
                      id={`addon-quantity-${addon.id}`}
                      label={`Quantité de ${addon.title}`}
                      hideLabel
                      value={addons[addon.id]}
                      stock={addon.stock}
                      onChange={(value) => setAddons((current) => ({ ...current, [addon.id]: value }))}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </details>
      )}

      {total !== null && (items.length > 1 || Number(quantity) > 1) && (
        <p className="text-[15px] text-ink">
          Total estimé : <strong>{formatPrice(total)}</strong>
          <span className="text-muted"> ({pluralize(items.length, 'article')}), hors taxes</span>
        </p>
      )}
      <p className="text-xs text-muted">
        Règlement direct auprès du fournisseur, sans paiement en ligne.
        {supplier.delivery_days ? ` Délai moyen : ${pluralize(supplier.delivery_days, 'jour')}.` : ''}
        {supplier.payment_terms ? ` Conditions : ${supplier.payment_terms}.` : ''}
      </p>

      {summaryOpen && valid && (
        <Modal
          title="Récapitulatif de votre commande"
          onClose={closeSummary}
          actions={
            <>
              <button type="button" className="btn-secondary" onClick={closeSummary} disabled={submitting}>
                Modifier ma sélection
              </button>
              <button type="button" className="btn-primary" onClick={confirm} disabled={submitting}>
                {submitting ? 'Validation…' : 'Confirmer la commande'}
              </button>
            </>
          }
        >
          <p>
            Fournisseur : <span className="font-semibold text-ink">{supplier.company_name}</span>
          </p>
          <ul className="mt-3 max-h-60 divide-y divide-line overflow-y-auto">
            {items.map((item) => (
              <li key={item.product_id} className="flex justify-between gap-4 py-2">
                <span className="min-w-0 text-ink">
                  {item.title}
                  <span className="block text-xs text-muted">
                    {formatNumber(item.quantity)} × {formatPrice(item.price)}
                  </span>
                </span>
                <span className="shrink-0 font-medium text-ink">{formatPrice(item.price * Number(item.quantity))}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="font-medium text-ink">Total à régler au fournisseur</span>
            <span className="text-xl font-bold text-brand-600">{formatPrice(total)}</span>
          </p>
          <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-ink">
            Aucun paiement en ligne — règlement selon les conditions du fournisseur (à la livraison ou par virement bancaire).
          </p>
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </Modal>
      )}
    </section>
  )
}
