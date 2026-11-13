/** Encadré rouge clair avec le motif du refus donné par l'administrateur (SCRUM-27). */
export default function RejectionNotice({ reason }) {
  return (
    <div className="mt-5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3" role="alert">
      <p className="text-sm font-semibold text-danger">Motif du refus</p>
      <p className="mt-1 text-sm whitespace-pre-line text-ink">
        {reason || 'Aucun motif précisé. Contactez l’équipe pour en savoir plus.'}
      </p>
    </div>
  )
}
