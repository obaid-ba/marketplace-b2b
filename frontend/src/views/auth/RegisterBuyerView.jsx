import { useState } from 'react'
import { Link } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  organization: '',
  sector: '',
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function passwordIsValid(value) {
  return value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)
}

/**
 * Inscription d'un porteur de projet (SCRUM-23).
 * Un seul écran : compte (nom, e-mail, mot de passe) et profil acheteur
 * (organisation ou projet, secteur). Les erreurs sont affichées champ par champ.
 */
export default function RegisterBuyerView() {
  const registerBuyer = useAuthStore((state) => state.registerBuyer)

  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(null)

  function clearFieldError(field) {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setError('')
  }

  const update = (field) => (event) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [field]: value }))
    clearFieldError(field)
  }

  /** Miroir des règles du serveur, pour un retour immédiat sans aller-retour réseau. */
  function validate() {
    const errors = {}

    if (!form.name.trim()) {
      errors.name = ['Le nom est obligatoire.']
    }
    if (!emailIsValid(form.email)) {
      errors.email = ['Saisissez une adresse e-mail valide.']
    }
    if (!passwordIsValid(form.password)) {
      errors.password = [
        'Mot de passe trop faible : 8 caractères minimum, une majuscule, une minuscule et un chiffre.',
      ]
    }
    if (form.password && form.password !== form.password_confirmation) {
      errors.password_confirmation = ['Les deux mots de passe ne correspondent pas.']
    }
    if (!form.organization.trim()) {
      errors.organization = ["L'organisation ou le projet représenté est obligatoire."]
    }
    if (!form.sector.trim()) {
      errors.sector = ["Le secteur d'activité est obligatoire."]
    }

    return errors
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const errors = validate()
    setFieldErrors(errors)
    setError('')
    if (Object.keys(errors).length) return

    setLoading(true)
    try {
      const result = await registerBuyer({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        password_confirmation: form.password_confirmation,
        organization: form.organization.trim(),
        sector: form.sector.trim(),
      })
      setCreated(result)
    } catch (requestError) {
      setFieldErrors(requestError.fieldErrors ?? {})
      setError(requestError.userMessage ?? 'Inscription impossible. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  if (created) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="card w-full max-w-lg" role="status">
          <p className="text-sm font-semibold text-emerald-600">Inscription enregistrée</p>
          <h1 className="mt-2 text-2xl font-semibold">Vérifiez votre boîte e-mail</h1>
          <p className="mt-3 text-sm text-slate-600">
            Nous avons envoyé un lien de vérification à{' '}
            <strong className="text-slate-900">{created.user.email}</strong>. Cliquez dessus pour
            activer votre compte.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Dès que votre adresse est vérifiée, votre compte est actif : aucune validation par un
            administrateur n&apos;est nécessaire.
          </p>

          <Link to={PATHS.login} className="btn-primary mt-6 w-full">
            Aller à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-2xl">
        <Link to={PATHS.registerChoice} className="text-sm text-brand-600">
          ← Changer de type de compte
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Inscription porteur de projet</h1>
        <p className="mt-1 text-sm text-slate-500">
          Créez votre compte acheteur pour publier vos besoins et recevoir des devis.
        </p>

        <form className="mt-6 space-y-4" noValidate onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium">
              Nom
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              className="input"
              required
              value={form.name}
              onChange={update('name')}
            />
            {fieldErrors.name && <p className="mt-1 text-sm text-red-600">{fieldErrors.name[0]}</p>}
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
              value={form.email}
              onChange={update('email')}
              aria-describedby="email-help"
            />
            <p id="email-help" className="mt-1 text-xs text-slate-500">
              Elle servira d&apos;identifiant de connexion.
            </p>
            {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email[0]}</p>}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="input"
              required
              value={form.password}
              onChange={update('password')}
              aria-describedby="password-help"
            />
            <p id="password-help" className="mt-1 text-xs text-slate-500">
              8 caractères minimum, avec une majuscule, une minuscule et un chiffre.
            </p>
            {fieldErrors.password && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.password[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="password_confirmation" className="mb-1 block text-sm font-medium">
              Confirmation du mot de passe
            </label>
            <input
              id="password_confirmation"
              type="password"
              autoComplete="new-password"
              className="input"
              required
              value={form.password_confirmation}
              onChange={update('password_confirmation')}
            />
            {fieldErrors.password_confirmation && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.password_confirmation[0]}</p>
            )}
          </div>

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
              value={form.organization}
              onChange={update('organization')}
            />
            {fieldErrors.organization && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.organization[0]}</p>
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
              value={form.sector}
              onChange={update('sector')}
              aria-describedby="sector-help"
            />
            <p id="sector-help" className="mt-1 text-xs text-slate-500">
              Par exemple : Bâtiment, Informatique, Santé…
            </p>
            {fieldErrors.sector && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.sector[0]}</p>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <Link to={PATHS.registerChoice} className="btn-ghost">
              Annuler
            </Link>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Envoi…' : 'Créer mon compte'}
            </button>
          </div>

          <p className="text-center text-sm text-slate-600">
            Déjà inscrit ?{' '}
            <Link to={PATHS.login} className="font-medium text-brand-600 hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
