import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { addFavoriteSupplier, removeFavoriteSupplier } from '@/api/favorites'
import { loginPath } from '@/router/paths'
import { selectRole, useAuthStore } from '@/stores/auth'
import { ROLES } from '@/utils/roles'

/**
 * Ajouter / retirer un fournisseur des favoris (SCRUM-39), sur la fiche produit et la fiche fournisseur.
 * - invité : envoie vers la connexion puis revient sur la page ;
 * - fournisseur ou administrateur : bouton masqué ;
 * - porteur de projet : mise à jour immédiate, annulée si l'API échoue.
 *
 * variant « button » (libellé) ou « icon » (cœur seul).
 */
export function HeartIcon({ filled, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path
        d="M12 20.5s-7.5-4.4-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.5 1.1 5 2.9 1.5-1.8 3-2.9 5-2.9 3.4 0 5.6 3.4 4.3 6.8-1.8 4.8-9.3 9.2-9.3 9.2z"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function FavoriteButton({ supplierId, initialIsFavorite = false, variant = 'button', label, onChange }) {
  const role = useAuthStore(selectRole)
  const navigate = useNavigate()
  const location = useLocation()
  const [isFavorite, setIsFavorite] = useState(Boolean(initialIsFavorite))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => setIsFavorite(Boolean(initialIsFavorite)), [initialIsFavorite])

  if (role && role !== ROLES.BUYER) return null

  async function toggle() {
    if (!role) {
      navigate(loginPath(location.pathname + location.search))
      return
    }
    const next = !isFavorite
    setIsFavorite(next)
    setPending(true)
    setError(null)
    try {
      await (next ? addFavoriteSupplier(supplierId) : removeFavoriteSupplier(supplierId))
      onChange?.(next)
    } catch (err) {
      setIsFavorite(!next)
      setError(err?.userMessage ?? 'Action impossible pour le moment.')
    } finally {
      setPending(false)
    }
  }

  const text = label ?? (isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris')
  const title = error ?? (role ? text : 'Connectez-vous pour ajouter ce fournisseur à vos favoris')

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={isFavorite}
        aria-label={text}
        title={title}
        className={`grid h-9 w-9 place-items-center rounded-full transition hover:bg-danger-soft ${
          isFavorite ? 'text-danger' : 'text-muted'
        }`}
      >
        <HeartIcon filled={isFavorite} className="h-5 w-5" />
      </button>
    )
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={isFavorite}
        title={title}
        className={`btn-secondary gap-2 px-5 py-2.5 font-semibold ${isFavorite ? 'text-danger' : ''}`}
      >
        <HeartIcon filled={isFavorite} />
        {text}
      </button>
      {error && (
        <span role="alert" className="mt-1 text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  )
}
