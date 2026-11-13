import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { deactivateAccount, deleteAccount } from '@/api/account'
import { PATHS } from '@/router/paths'
import { selectUser, useAuthStore } from '@/stores/auth'
import { landingPathFor } from '@/utils/roles'

/**
 * Paramètres du compte (SCRUM-30).
 * Deux actions sensibles, chacune confirmée par le mot de passe actuel :
 * désactiver le compte (réversible par un administrateur) ou le supprimer
 * définitivement (suppression douce, historique conservé).
 * Après succès, l'utilisateur est déconnecté et renvoyé vers la connexion.
 */
export default function AccountSettingsView() {
  const user = useAuthStore(selectUser)
  const navigate = useNavigate()

  const [pending, setPending] = useState(null) // 'deactivate' | 'delete' | null
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function openConfirmation(action) {
    setPending(action)
    setPassword('')
    setError(null)
  }

  function cancel() {
    setPending(null)
    setPassword('')
    setError(null)
  }

  async function handleConfirm(event) {
    event.preventDefault()
    setError(null)

    if (!password) {
      setError('Saisissez votre mot de passe pour confirmer.')
      return
    }

    setLoading(true)
    try {
      const action = pending
      const data = action === 'delete' ? await deleteAccount(password) : await deactivateAccount(password)

      // Déconnexion immédiate : les jetons Sanctum ont été révoqués côté API.
      useAuthStore.getState().clear()
      navigate(PATHS.login, { replace: true, state: { notice: data.message } })
    } catch (e) {
      setError(e.fieldErrors?.password?.[0] ?? e.userMessage ?? "L'opération a échoué. Réessayez.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={landingPathFor(user)} className="text-sm text-brand-600">
        ← Mon espace
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Paramètres du compte</h1>
      <p className="mt-1 text-sm text-slate-500">
        Gérez la fin de vie de votre compte. Ces actions vous déconnectent immédiatement de tous vos
        appareils.
      </p>

      {pending ? (
        <ConfirmPassword
          action={pending}
          password={password}
          error={error}
          loading={loading}
          onChange={(value) => {
            setPassword(value)
            setError(null)
          }}
          onCancel={cancel}
          onSubmit={handleConfirm}
        />
      ) : (
        <>
          <section className="card mt-6">
            <h2 className="text-lg font-semibold">Désactiver mon compte</h2>
            <p className="mt-2 text-sm text-slate-600">
              Votre profil et vos offres ne sont plus visibles dans le catalogue ni dans les
              recherches. Vous ne pouvez plus vous connecter. Un administrateur peut réactiver votre
              compte si vous changez d&apos;avis.
            </p>
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-ghost border border-slate-300" onClick={() => openConfirmation('deactivate')}>
                Désactiver mon compte
              </button>
            </div>
          </section>

          <section className="card mt-6 border-red-200">
            <h2 className="text-lg font-semibold text-red-800">Supprimer mon compte</h2>
            <p className="mt-2 text-sm text-red-800">
              Votre compte sera supprimé définitivement. Vos commandes, factures et avis sont
              conservés pour l&apos;historique, mais vous ne pourrez plus vous connecter.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="btn bg-red-600 text-white hover:bg-red-700"
                onClick={() => openConfirmation('delete')}
              >
                Supprimer mon compte
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function ConfirmPassword({ action, password, error, loading, onChange, onCancel, onSubmit }) {
  const isDelete = action === 'delete'

  return (
    <section className={`card mt-6 ${isDelete ? 'border-red-300' : ''}`}>
      <h2 className={`text-lg font-semibold ${isDelete ? 'text-red-800' : ''}`}>
        {isDelete ? 'Confirmer la suppression' : 'Confirmer la désactivation'}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {isDelete
          ? 'Cette action est définitive. Saisissez votre mot de passe pour supprimer votre compte.'
          : 'Saisissez votre mot de passe pour désactiver votre compte et vous déconnecter de tous vos appareils.'}
      </p>

      <form className="mt-4 space-y-4" noValidate onSubmit={onSubmit}>
        <div>
          <label htmlFor="confirm_password" className="mb-1 block text-sm font-medium">
            Mot de passe
          </label>
          <input
            id="confirm_password"
            type="password"
            autoComplete="current-password"
            className="input"
            required
            value={password}
            onChange={(event) => onChange(event.target.value)}
          />
          {error && (
            <p className={`mt-1 text-sm ${isDelete ? 'text-red-700' : 'text-red-600'}`} role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
          <button
            type="submit"
            className={`btn text-white ${isDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}
            disabled={loading}
          >
            {loading
              ? 'Traitement…'
              : isDelete
                ? 'Supprimer définitivement'
                : 'Confirmer la désactivation'}
          </button>
        </div>
      </form>
    </section>
  )
}
