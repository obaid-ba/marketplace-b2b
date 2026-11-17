import StarRating from '@/components/StarRating'

/**
 * Un avis client (SCRUM-37 / SCRUM-36) : auteur abrégé, étoiles, commentaire, réponse du fournisseur en retrait.
 */
export default function ReviewItem({ review, supplierName }) {
  return (
    <article className="border-b border-line py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[15px] font-semibold text-ink">{review.author}</p>
        <StarRating value={review.rating} />
        {review.created_at && (
          <time dateTime={review.created_at} className="text-xs text-muted">
            {new Date(review.created_at).toLocaleDateString('fr-FR', { dateStyle: 'medium' })}
          </time>
        )}
      </div>
      {review.comment && <p className="mt-1.5 text-[15px] text-muted">{review.comment}</p>}
      {review.supplier_reply && (
        <div className="mt-3 ml-4 border-l-2 border-brand-100 pl-4 sm:ml-6">
          <p className="text-xs font-semibold text-brand-600">
            {supplierName ? `Réponse de ${supplierName}` : 'Réponse du fournisseur'}
          </p>
          <p className="mt-1 text-sm text-ink">{review.supplier_reply}</p>
        </div>
      )}
    </article>
  )
}
