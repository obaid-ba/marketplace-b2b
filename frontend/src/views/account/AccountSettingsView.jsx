import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  deactivateAccount,
  deleteAccount,
  updateAccount,
  updatePassword,
} from '@/api/account'
import { PATHS } from '@/router/paths'
import { selectUser, useAuthStore } from '@/stores/auth'
import { ROLES, landingPathFor } from '@/utils/roles'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PASSWORD_RULES = [
  { id: 'length', label: '8 caractères minimum', test: (value) => value.length >= 8 },
  { id: 'upper', label: 'Une majuscule', test: (value) => /\p{Lu}/u.test(value) },
  { id: 'lower', label: 'Une minuscule', test: (value) => /\p{Ll}/u.test(value) },
  { id: 'digit', label: 'Un chiffre', test: (value) => /\d/.test(value) },
]

const TABS = [
  { id: 'informations', label: 'Informations' },
  { id: 'password', label: 'Mot de passe' },
  { id: 'danger', label: 'Supprimer le compte' },
]

function isStrongPassword(value) {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}

/** Le téléphone est stocké « +216 71000000 » ; le formulaire n'affiche que les 8 chiffres. */
function phoneDigits(phone) {
  return (phone ?? '').replace(/\D/g, '').replace(/^216/, '').slice(0, 8)
}

function firstError(errors, field) {
  const value = errors?.[field]
  if (!value) return null
  return Array.isArray(value) ? value[0] : value
}

/**
 * Paramètres du compte (SCRUM-98, stories SCRUM-29 / SCRUM-30).
 * Trois onglets : informations personnelles et e-mail (une nouvelle adresse repasse
 * par la vérification), mot de passe (ancien mot de passe exigé), et suppression ou
 * désactivation du compte (confirmation par mot de passe, déconnexion immédiate).
 */
export default function AccountSettingsView() {
  const user = useAuthStore(selectUser)
  const setUser = useAuthStore((state) => state.setUser)
  const navigate = useNavigate()
  const isBuyer = user?.role === ROLES.BUYER

  const [activeTab, setActiveTab] = useState('informations')

  const [profile, setProfile] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    email: user?.email ?? '',
    phone: phoneDigits(user?.phone),
    organization: user?.buyer_profile?.organization ?? '',
    sector: user?.buyer_profile?.sector ?? '',
  })
  const [profileErrors, setProfileErrors] = useState({})
  const [profileFeedback, setProfileFeedback] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const [passwords, setPasswords] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [passwordFeedback, setPasswordFeedback] = useState(null)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSubmitted, setPasswordSubmitted] = useState(false)

  const [pendingAction, setPendingAction] = useState(null) // 'deactivate' | 'delete' | null
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const emailChanged = profile.email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase()

  const updateProfileField = (field) => (event) => {
    const { value } = event.target
    setProfile((current) => ({ ...current, [field]: value }))
    setProfileErrors((current) => ({ ...current, [field]: null }))
    setProfileFeedback(null)
  }

  const updatePasswordField = (field) => (event) => {
    const { value } = event.target
    setPasswords((current) => ({ ...current, [field]: value }))
    setPasswordErrors((current) => ({ ...current, [field]: null }))
    setPasswordFeedback(null)
  }

  async function handleProfileSubmit(event) {
    event.preventDefault()
    setProfileFeedback(null)

    const errors = {}
    if (!profile.first_name.trim()) errors.first_name = ['Le prénom est obligatoire.']
    if (!profile.last_name.trim()) errors.last_name = ['Le nom est obligatoire.']
    if (!/^\d{8}$/.test(profile.phone.replace(/\s/g, ''))) {
      errors.phone = ['Le téléphone doit contenir 8 chiffres (préfixe +216).']
    }
    if (!EMAIL_PATTERN.test(profile.email.trim())) {
      errors.email = ['Saisissez une adresse e-mail valide.']
    }
    if (isBuyer && !profile.organization.trim()) {
      errors.organization = ["L'organisation ou le projet représenté est obligatoire."]
    }
    if (isBuyer && !profile.sector.trim()) {
      errors.sector = ["Le secteur d'activité est obligatoire."]
    }

    setProfileErrors(errors)
    if (Object.keys(errors).length) return

    setProfileLoading(true)
    try {
      const data = await updateAccount({
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        email: profile.email.trim(),
        phone: `+216 ${profile.phone.replace(/\s/g, '')}`,
        ...(isBuyer
          ? { organization: profile.organization.trim(), sector: profile.sector.trim() }
          : {}),
      })
      // Après un changement d'adresse, l'API a remis email_verified à false.
      setUser(data.user)
      setProfileFeedback({ type: 'success', text: data.message })
    } catch (error) {
      setProfileErrors(error.fieldErrors ?? {})
      setProfileFeedback({
        type: 'error',
        text: error.userMessage ?? 'Modification impossible. Réessayez.',
      })
    } finally {
      setProfileLoading(false)
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setPasswordSubmitted(true)
    setPasswordFeedback(null)

    const errors = {}
    if (!passwords.current_password) {
      errors.current_password = ['Le mot de passe actuel est obligatoire.']
    }
    if (!isStrongPassword(passwords.password)) {
      errors.password = [
        'Mot de passe trop faible : 8 caractères minimum, une majuscule, une minuscule et un chiffre.',
      ]
    }
    if (passwords.password && passwords.password !== passwords.password_confirmation) {
      errors.password_confirmation = ['Les deux mots de passe ne correspondent pas.']
    }
    if (passwords.password && passwords.password === passwords.current_password) {
      errors.password = ["Le nouveau mot de passe doit être différent de l'ancien."]
    }

    setPasswordErrors(errors)
    if (Object.keys(errors).length) return

    setPasswordLoading(true)
    try {
      const data = await updatePassword(passwords)
      setPasswords({ current_password: '', password: '', password_confirmation: '' })
      setPasswordSubmitted(false)
      setPasswordFeedback({ type: 'success', text: data.message })
    } catch (error) {
      setPasswordErrors(error.fieldErrors ?? {})
      setPasswordFeedback({
        type: 'error',
        text: error.userMessage ?? 'Le changement de mot de passe a échoué.',
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  function openConfirmation(action) {
    setPendingAction(action)
    setConfirmPassword('')
    setConfirmError(null)
  }

  function closeConfirmation() {
    if (confirmLoading) return
    setPendingAction(null)
    setConfirmPassword('')
    setConfirmError(null)
  }

  async function handleAccountAction(event) {
    event.preventDefault()
    setConfirmError(null)

    if (!confirmPassword) {
      setConfirmError('Saisissez votre mot de passe pour confirmer.')
      return
    }

    setConfirmLoading(true)
    try {
      const action = pendingAction
      const data =
        action === 'delete' ? await deleteAccount(confirmPassword) : await deactivateAccount(confirmPassword)

      // Déconnexion immédiate : les jetons Sanctum ont été révoqués côté API.
      useAuthStore.getState().clear()
      navigate(PATHS.login, { replace: true, state: { notice: data.message } })
    } catch (error) {
      setConfirmError(error.fieldErrors?.password?.[0] ?? error.userMessage ?? "L'opération a échoué. Réessayez.")
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={landingPathFor(user)} className="text-sm text-brand-600">
        ← Mon espace
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Paramètres du compte</h1>
      <p className="mt-1 text-sm text-slate-500">
        Mettez à jour vos informations personnelles, votre mot de passe, ou quittez la plateforme.
      </p>

      {!user?.email_verified && (
        <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          Votre adresse e-mail n&apos;est pas encore vérifiée. Les espaces métier restent fermés
          jusqu&apos;à la confirmation du lien reçu.{' '}
          <Link to={PATHS.verifyNotice} className="font-medium underline">
            Renvoyer le lien de vérification
          </Link>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Paramètres du compte"
        className="mt-6 flex flex-wrap gap-2 border-b border-slate-200"
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`account-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`account-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                selected
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`account-panel-${activeTab}`}
        aria-labelledby={`account-tab-${activeTab}`}
        className="mt-6"
      >
        {activeTab === 'informations' && (
          <section className="card">
            <h2 className="text-lg font-semibold">Informations personnelles</h2>
            <p className="mt-1 text-sm text-slate-500">
              Votre nom, votre e-mail et votre téléphone sont utilisés dans vos échanges sur la
              plateforme.
            </p>

            <form className="mt-4 space-y-4" noValidate onSubmit={handleProfileSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="first_name" className="mb-1 block text-sm font-medium">
                    Prénom
                  </label>
                  <input
                    id="first_name"
                    type="text"
                    autoComplete="given-name"
                    className="input"
                    required
                    value={profile.first_name}
                    onChange={updateProfileField('first_name')}
                  />
                  {firstError(profileErrors, 'first_name') && (
                    <p className="mt-1 text-sm text-red-600">{firstError(profileErrors, 'first_name')}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="last_name" className="mb-1 block text-sm font-medium">
                    Nom
                  </label>
                  <input
                    id="last_name"
                    type="text"
                    autoComplete="family-name"
                    className="input"
                    required
                    value={profile.last_name}
                    onChange={updateProfileField('last_name')}
                  />
                  {firstError(profileErrors, 'last_name') && (
                    <p className="mt-1 text-sm text-red-600">{firstError(profileErrors, 'last_name')}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium">
                  Adresse e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="input"
                  required
                  value={profile.email}
                  onChange={updateProfileField('email')}
                  aria-describedby="account-email-help"
                />
                <p id="account-email-help" className="mt-1 text-xs text-slate-500">
                  Un changement d&apos;adresse demande une nouvelle vérification par e-mail.
                </p>
                {firstError(profileErrors, 'email') && (
                  <p className="mt-1 text-sm text-red-600">{firstError(profileErrors, 'email')}</p>
                )}
                {emailChanged && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
                    Votre adresse va changer : un lien de vérification sera envoyé à la nouvelle
                    adresse et les espaces métier resteront fermés jusqu&apos;à sa confirmation.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium">
                  Téléphone
                </label>
                <div className="flex items-stretch gap-2">
                  <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                    +216
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    className="input"
                    required
                    maxLength={8}
                    value={profile.phone}
                    onChange={updateProfileField('phone')}
                    aria-describedby="account-phone-help"
                  />
                </div>
                <p id="account-phone-help" className="mt-1 text-xs text-slate-500">
                  8 chiffres, sans l&apos;indicatif.
                </p>
                {firstError(profileErrors, 'phone') && (
                  <p className="mt-1 text-sm text-red-600">{firstError(profileErrors, 'phone')}</p>
                )}
              </div>

              {isBuyer && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="organization" className="mb-1 block text-sm font-medium">
                      Organisation ou projet représenté
                    </label>
                    <input
                      id="organization"
                      type="text"
                      autoComplete="organization"
                      className="input"
                      required
                      value={profile.organization}
                      onChange={updateProfileField('organization')}
                    />
                    {firstError(profileErrors, 'organization') && (
                      <p className="mt-1 text-sm text-red-600">
                        {firstError(profileErrors, 'organization')}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="sector" className="mb-1 block text-sm font-medium">
                      Secteur d&apos;activité
                    </label>
                    <input
                      id="sector"
                      type="text"
                      className="input"
                      required
                      value={profile.sector}
                      onChange={updateProfileField('sector')}
                    />
                    {firstError(profileErrors, 'sector') && (
                      <p className="mt-1 text-sm text-red-600">{firstError(profileErrors, 'sector')}</p>
                    )}
                  </div>
                </div>
              )}

              <Feedback feedback={profileFeedback} />

              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={profileLoading}>
                  {profileLoading ? 'Enregistrement…' : 'Enregistrer mes informations'}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'password' && (
          <section className="card">
            <h2 className="text-lg font-semibold">Mot de passe</h2>
            <p className="mt-1 text-sm text-slate-500">
              Saisissez votre mot de passe actuel, puis choisissez-en un nouveau.
            </p>

            <form className="mt-4 space-y-4" noValidate onSubmit={handlePasswordSubmit}>
              <div>
                <label htmlFor="current_password" className="mb-1 block text-sm font-medium">
                  Mot de passe actuel
                </label>
                <input
                  id="current_password"
                  type="password"
                  autoComplete="current-password"
                  className="input"
                  required
                  value={passwords.current_password}
                  onChange={updatePasswordField('current_password')}
                />
                {firstError(passwordErrors, 'current_password') && (
                  <p className="mt-1 text-sm text-red-600">
                    {firstError(passwordErrors, 'current_password')}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="new_password" className="mb-1 block text-sm font-medium">
                  Nouveau mot de passe
                </label>
                <input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  className="input"
                  required
                  value={passwords.password}
                  onChange={updatePasswordField('password')}
                  aria-describedby="account-password-rules"
                />
                <ul id="account-password-rules" className="mt-2 grid grid-cols-2 gap-1 text-xs">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(passwords.password)
                    return (
                      <li
                        key={rule.id}
                        className={ok ? 'text-green-700' : passwordSubmitted ? 'text-red-600' : 'text-slate-500'}
                      >
                        {ok ? '✓' : '•'} {rule.label}
                      </li>
                    )
                  })}
                </ul>
                {firstError(passwordErrors, 'password') && (
                  <p className="mt-1 text-sm text-red-600">{firstError(passwordErrors, 'password')}</p>
                )}
              </div>

              <div>
                <label htmlFor="password_confirmation" className="mb-1 block text-sm font-medium">
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  id="password_confirmation"
                  type="password"
                  autoComplete="new-password"
                  className="input"
                  required
                  value={passwords.password_confirmation}
                  onChange={updatePasswordField('password_confirmation')}
                />
                {firstError(passwordErrors, 'password_confirmation') && (
                  <p className="mt-1 text-sm text-red-600">
                    {firstError(passwordErrors, 'password_confirmation')}
                  </p>
                )}
              </div>

              <Feedback feedback={passwordFeedback} />

              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={passwordLoading}>
                  {passwordLoading ? 'Modification…' : 'Modifier mon mot de passe'}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'danger' && (
          <div className="space-y-6">
            <section className="card">
              <h2 className="text-lg font-semibold">Désactiver mon compte</h2>
              <p className="mt-2 text-sm text-slate-600">
                Votre profil et vos offres ne sont plus visibles dans le catalogue ni dans les
                recherches. Vous ne pouvez plus vous connecter. Un administrateur peut réactiver
                votre compte si vous changez d&apos;avis.
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="btn-ghost border border-slate-300"
                  onClick={() => openConfirmation('deactivate')}
                >
                  Désactiver mon compte
                </button>
              </div>
            </section>

            <section className="card border-red-200">
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
          </div>
        )}
      </div>

      {pendingAction && (
        <ConfirmAccountAction
          action={pendingAction}
          password={confirmPassword}
          error={confirmError}
          loading={confirmLoading}
          onChange={(value) => {
            setConfirmPassword(value)
            setConfirmError(null)
          }}
          onCancel={closeConfirmation}
          onSubmit={handleAccountAction}
        />
      )}
    </div>
  )
}

function Feedback({ feedback }) {
  if (!feedback) return null

  return (
    <p
      role={feedback.type === 'error' ? 'alert' : 'status'}
      className={`rounded-lg px-3 py-2 text-sm ${
        feedback.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
      }`}
    >
      {feedback.text}
    </p>
  )
}

function ConfirmAccountAction({ action, password, error, loading, onChange, onCancel, onSubmit }) {
  const isDelete = action === 'delete'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-account-title"
        className={`card w-full max-w-md ${isDelete ? 'border-red-300' : ''}`}
      >
        <h2
          id="confirm-account-title"
          className={`text-lg font-semibold ${isDelete ? 'text-red-800' : ''}`}
        >
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
              autoFocus
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
      </div>
    </div>
  )
}
