/**
 * Dégradé pastel affiché quand un produit n'a pas de photo (maquettes V1 à V4).
 * La teinte dépend de l'identifiant pour varier d'une carte à l'autre.
 */
const GRADIENTS = [
  'from-[#e6e1fb] to-[#fde3d3]', // lavande → pêche
  'from-[#dfe6fd] to-[#ebe1fb]', // bleu → lavande
  'from-[#fde3d3] to-[#ebe6fb]', // pêche → lavande
  'from-[#dff3fb] to-[#ebe6fb]', // ciel → lavande
]

export default function ProductImagePlaceholder({ seed = 0, label = 'Image produit', className = '' }) {
  const gradient = GRADIENTS[Math.abs(Number(seed) || 0) % GRADIENTS.length]
  return (
    <div
      className={`grid place-items-center bg-gradient-to-br ${gradient} text-xs font-medium text-brand-600 ${className}`}
      aria-hidden="true"
    >
      {label}
    </div>
  )
}
