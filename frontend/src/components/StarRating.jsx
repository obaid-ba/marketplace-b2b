import { formatRating } from '@/utils/format'

/**
 * Étoiles de notation (maquettes V3, V4) : pleines en orange, vides en contour.
 * value : note de 0 à 5 (arrondie à l'étoile la plus proche pour l'affichage).
 */
export default function StarRating({ value = 0, className = 'text-accent-strong', size = 'text-sm' }) {
  const rounded = Math.round(Number(value))
  return (
    <span className={`inline-flex tracking-tight ${size} ${className}`} role="img" aria-label={`${formatRating(value)} sur 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} aria-hidden="true">
          {star <= rounded ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}
