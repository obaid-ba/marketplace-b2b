import { useState } from 'react'
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder'

/**
 * Photo d'un produit. Sans photo, ou si le fichier est introuvable, affiche le dégradé à la place
 * d'une image cassée. seed et label : voir ProductImagePlaceholder.
 */
export default function ProductImage({ src, alt, seed, label, className = '', imgClassName = '', ...props }) {
  const [failedSrc, setFailedSrc] = useState(null)

  if (!src || failedSrc === src) return <ProductImagePlaceholder seed={seed} label={label} className={className} />

  return <img {...props} src={src} alt={alt} className={`${className} object-cover ${imgClassName}`} onError={() => setFailedSrc(src)} />
}
