import { SUPPLIER_STATUS } from '@/utils/roles'
import { formatRelativeDate } from '@/utils/relativeDate'
import TimelineStep from './TimelineStep'

/**
 * Frise en 4 étapes du dossier fournisseur (maquette A5) :
 * compte créé → e-mail vérifié → validation par l'administrateur → publication du profil.
 *
 * @param {{ status: string, steps: { account_created_at?: string, email_verified_at?: string, reviewed_at?: string } }} props
 */
export default function ValidationTimeline({ status, steps }) {
  const rejected = status === SUPPLIER_STATUS.REJECTED
  const validated = status === SUPPLIER_STATUS.VALIDATED
  const reviewedAt = formatRelativeDate(steps?.reviewed_at)

  let reviewState = 'current'
  let reviewSubtitle = 'Délai habituel : 24 à 48 h'
  if (rejected) {
    reviewState = 'rejected'
    reviewSubtitle = reviewedAt ? `Refusé : ${reviewedAt}` : 'Documents à renvoyer'
  } else if (validated) {
    reviewState = 'done'
    reviewSubtitle = reviewedAt
  }

  return (
    <ol className="mt-6" aria-label="Étapes de validation du compte">
      <TimelineStep state="done" number={1} title="Compte créé" subtitle={formatRelativeDate(steps?.account_created_at)} />
      <TimelineStep
        state={steps?.email_verified_at ? 'done' : 'current'}
        number={2}
        title="E-mail vérifié"
        subtitle={formatRelativeDate(steps?.email_verified_at)}
      />
      <TimelineStep state={reviewState} number={3} title="Validation par l’administrateur" subtitle={reviewSubtitle} />
      <TimelineStep state="upcoming" number={4} title="Publication du profil" subtitle="Après validation" />
    </ol>
  )
}
