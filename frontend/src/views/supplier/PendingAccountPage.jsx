import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import AuthLayout from '@/layouts/AuthLayout'
import { fetchValidationStatus } from '@/api/supplierValidation'
import { useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import { SUPPLIER_STATUS } from '@/utils/roles'
import ValidationTimeline from './pending/ValidationTimeline'
import RejectionNotice from './pending/RejectionNotice'
import ResubmitDocumentsForm from './pending/ResubmitDocumentsForm'

/**
 * « Compte en attente de validation » (SCRUM-27, maquette A5) : un fournisseur arrive ici
 * après avoir vérifié son e-mail, tant qu'un administrateur n'a pas validé son dossier.
 * Dossier refusé : motif + renvoi de documents, qui repasse le dossier « en attente ».
 */
export default function PendingAccountPage() {
  const navigate = useNavigate()
  const fetchMe = useAuthStore((state) => state.fetchMe)
  const logout = useAuthStore((state) => state.logout)

  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const status = await fetchValidationStatus()
      if (status.status === SUPPLIER_STATUS.VALIDATED) {
        // Compte validé entre-temps : on met à jour l'utilisateur pour que la garde laisse passer.
        await fetchMe()
        navigate(PATHS.supplier, { replace: true })
        return
      }
      setData(status)
    } catch (error) {
      setLoadError(error.userMessage ?? 'Impossible de charger l’état de votre dossier.')
    }
  }, [fetchMe, navigate])

  useEffect(() => {
    load()
  }, [load])

  async function handleResubmitted(result) {
    setNotice(result?.message ?? 'Document envoyé. Votre dossier repasse en cours d’examen.')
    await Promise.all([load(), fetchMe()])
  }

  async function handleLogout() {
    await logout()
    navigate(PATHS.login)
  }

  const rejected = data?.status === SUPPLIER_STATUS.REJECTED

  return (
    <AuthLayout>
      <div className="w-full max-w-[544px] rounded-2xl border border-line bg-surface p-6 sm:p-10">
        {loadError ? (
          <div role="alert">
            <h1 className="text-2xl font-bold text-ink">État du compte indisponible</h1>
            <p className="mt-2 text-[15px] text-muted">{loadError}</p>
            <button type="button" className="btn-primary mt-6 w-full py-2.5" onClick={load}>
              Réessayer
            </button>
          </div>
        ) : !data ? (
          <LoadingSkeleton />
        ) : (
          <>
            <h1 className="text-2xl font-bold text-ink sm:text-[28px]">
              {rejected ? 'Dossier refusé' : 'Compte en attente de validation'}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {rejected
                ? 'Notre équipe n’a pas pu valider votre compte. Corrigez le point ci-dessous et renvoyez vos documents.'
                : 'Notre équipe vérifie vos documents. Vous serez notifié dès que votre compte sera validé.'}
            </p>

            {notice && !rejected && (
              <p className="mt-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-success" role="status">
                {notice}
              </p>
            )}

            {rejected && <RejectionNotice reason={data.rejection_reason} />}

            <ValidationTimeline status={data.status} steps={data.steps} />

            {rejected && <ResubmitDocumentsForm onSubmitted={handleResubmitted} />}
          </>
        )}

        <div className="mt-6 space-y-5">
          <Link to={PATHS.supplierProfile} className="btn-primary w-full py-2.5">
            Préparer mon profil (sans le publier)
          </Link>
          <button type="button" className="btn-secondary w-full py-2.5" onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      </div>
    </AuthLayout>
  )
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Chargement de l’état du compte">
      <div className="h-8 w-3/4 rounded bg-page" />
      <div className="mt-3 h-4 w-full rounded bg-page" />
      <div className="mt-2 h-4 w-2/3 rounded bg-page" />
      <div className="mt-8 space-y-5">
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-3.5">
            <div className="h-6 w-6 rounded-full bg-page" />
            <div className="h-4 flex-1 rounded bg-page" />
            <div className="h-5 w-16 rounded-full bg-page" />
          </div>
        ))}
      </div>
    </div>
  )
}
