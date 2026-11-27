/** État vide d'une section : message court et, si besoin, une action. */
export default function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-page/60 p-6 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
