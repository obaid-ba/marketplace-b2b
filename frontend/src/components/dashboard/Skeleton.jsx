/** Bloc gris animé utilisé pendant le chargement (respecte `prefers-reduced-motion` via Tailwind). */
export default function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />
}
