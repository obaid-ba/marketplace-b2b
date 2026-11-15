import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'

const BUYER_TYPES = [
  { value: 'individu', label: 'Individu' },
  { value: 'startup', label: 'Startup' },
  { value: 'entreprise', label: 'Entreprise' },
  { value: 'association', label: 'Association' },
  { value: 'institution', label: 'Institution' },
]

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  password_confirmation: '',
  buyer_type: '',
  organization: '',
  sector: '',
  region_id: '',
  terms_accepted: false,
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function passwordIsValid(value) {
  return value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)
}

function phoneIsValid(value) {
  return /^\d{8}$/.test(value.replace(/\s/g, ''))
}

/**
 * Inscription d'un porteur de projet (SCRUM-23).
 * Champs obligatoires de docs/ENTITIES.md : compte (prénom, nom, e-mail,
 * téléphone, mot de passe) et profil (type de porteur, organisation, secteur,
 * région, CGU). Les erreurs sont affichées champ par champ.
 */
export default function RegisterBuyerView() {
  const registerBuyer = useAuthStore((state) => state.registerBuyer)

  const [form, setForm] = useState(EMPTY_FORM)
  const [regions, setRegions] = useState([])
  const [referencesError, setReferencesError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(null)

  async function loadRegions() {
    setReferencesError('')
    try {
      const { data } = await http.get('/reference/regions')
      setRegions(data)
    } catch {
      setReferencesError('Impossible de charger les régions. Réessayez.')
    }
  }

  useEffect(() => {
    loadRegions()
  }, [])

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
    const { value, checked, type } = event.target
    setForm((current) => ({ ...current, [field]: type === 'checkbox' ? checked : value }))
    clearFieldError(field)
  }

  /** Miroir des règles du serveur, pour un retour immédiat sans aller-retour réseau. */
  function validate() {
    const errors = {}

    if (!form.first_name.trim()) {
      errors.first_name = ['Le prénom est obligatoire.']
    }
    if (!form.last_name.trim()) {
      errors.last_name = ['Le nom est obligatoire.']
    }
    if (!emailIsValid(form.email)) {
      errors.email = ['Saisissez une adresse e-mail valide.']
    }
    if (!phoneIsValid(form.phone)) {
      errors.phone = ['Le téléphone doit contenir 8 chiffres (préfixe +216).']
    }
    if (!passwordIsValid(form.password)) {
      errors.password = [
        'Mot de passe trop faible : 8 caractères minimum, une majuscule, une minuscule et un chiffre.',
      ]
    }
    if (form.password && form.password !== form.password_confirmation) {
      errors.password_confirmation = ['Les deux mots de passe ne correspondent pas.']
    }
    if (!form.buyer_type) {
      errors.buyer_type = ['Le type de porteur est obligatoire.']
    }
    if (!form.organization.trim()) {
      errors.organization = ["L'organisation ou le projet représenté est obligatoire."]
    }
    if (!form.sector.trim()) {
      errors.sector = ["Le secteur d'activité est obligatoire."]
    }
    if (!form.region_id) {
      errors.region_id = ['La région est obligatoire.']
    }
    if (!form.terms_accepted) {
      errors.terms_accepted = ["Vous devez accepter les conditions d'utilisation."]
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
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: `+216 ${form.phone.replace(/\s/g, '')}`,
        password: form.password,
        password_confirmation: form.password_confirmation,
        buyer_type: form.buyer_type,
        organization: form.organization.trim(),
        sector: form.sector.trim(),
        region_id: Number(form.region_id),
        terms_accepted: form.terms_accepted,
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
                value={form.first_name}
                onChange={update('first_name')}
              />
              {fieldErrors.first_name && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.first_name[0]}</p>
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
                value={form.last_name}
                onChange={update('last_name')}
              />
              {fieldErrors.last_name && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.last_name[0]}</p>
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
                placeholder="12 345 678"
                value={form.phone}
                onChange={update('phone')}
                aria-describedby="phone-help"
              />
            </div>
            <p id="phone-help" className="mt-1 text-xs text-slate-500">
              8 chiffres, sans l&apos;indicatif.
            </p>
            {fieldErrors.phone && <p className="mt-1 text-sm text-red-600">{fieldErrors.phone[0]}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="buyer_type" className="mb-1 block text-sm font-medium">
                Type de porteur
              </label>
              <select
                id="buyer_type"
                className="input"
                required
                value={form.buyer_type}
                onChange={update('buyer_type')}
              >
                <option value="">Sélectionnez…</option>
                {BUYER_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {fieldErrors.buyer_type && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.buyer_type[0]}</p>
              )}
            </div>

            <div>
              <label htmlFor="region_id" className="mb-1 block text-sm font-medium">
                Région
              </label>
              <select
                id="region_id"
                className="input"
                required
                value={form.region_id}
                onChange={update('region_id')}
              >
                <option value="">Sélectionnez…</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
              {referencesError && (
                <p className="mt-1 text-sm text-amber-700">
                  {referencesError}{' '}
                  <button type="button" className="font-medium underline" onClick={loadRegions}>
                    Réessayer
                  </button>
                </p>
              )}
              {fieldErrors.region_id && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.region_id[0]}</p>
              )}
            </div>
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

          <div>
            <label htmlFor="terms_accepted" className="flex items-start gap-2 text-sm text-slate-600">
              <input
                id="terms_accepted"
                type="checkbox"
                className="mt-1"
                checked={form.terms_accepted}
                onChange={update('terms_accepted')}
              />
              <span>J&apos;accepte les conditions générales d&apos;utilisation de la plateforme.</span>
            </label>
            {fieldErrors.terms_accepted && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.terms_accepted[0]}</p>
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
