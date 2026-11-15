import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'

const STEPS = [
  { number: 1, title: 'Compte' },
  { number: 2, title: 'Entreprise' },
  { number: 3, title: 'Justificatifs' },
]

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  password_confirmation: '',
  company_name: '',
  legal_form: '',
  tax_id: '',
  rne_number: '',
  sector: '',
  description: '',
  region_id: '',
  address: '',
  city: '',
  contact_name: '',
  contact_role: '',
  contact_phone: '',
  coverage_regions: [],
  categories: [],
}

const LEGAL_FORMS = [
  'personne physique',
  'SARL',
  'SUARL',
  'SA',
  'auto-entrepreneur',
  'coopérative',
]

function phoneIsValid(value) {
  return /^\d{8}$/.test(value.replace(/\s/g, ''))
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function passwordIsValid(value) {
  return value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)
}

/** Miroir des règles du backend : PDF/JPG/PNG, 5 Mo maximum. */
function fileError(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return 'Format accepté : PDF, JPG ou PNG.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Le fichier ne doit pas dépasser 5 Mo.'
  }
  return null
}

function stepForErrors(errors) {
  const keys = Object.keys(errors)

  if (keys.some((key) => ['first_name', 'last_name', 'email', 'phone', 'password', 'password_confirmation'].includes(key))) {
    return 1
  }
  if (
    keys.some((key) =>
      [
        'company_name',
        'legal_form',
        'tax_id',
        'rne_number',
        'sector',
        'description',
        'region_id',
        'address',
        'city',
        'contact_name',
        'contact_role',
        'contact_phone',
        'coverage_regions',
        'categories',
      ].includes(key) ||
      key.startsWith('coverage_regions.') ||
      key.startsWith('categories.'),
    )
  ) {
    return 2
  }
  return 3
}

export default function RegisterView() {
  const registerSupplier = useAuthStore((state) => state.registerSupplier)

  const [step, setStep] = useState(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [regions, setRegions] = useState([])
  const [categories, setCategories] = useState([])
  const [referencesLoading, setReferencesLoading] = useState(true)
  const [referencesError, setReferencesError] = useState('')
  const [commercialRegister, setCommercialRegister] = useState(null)
  const [taxCertificate, setTaxCertificate] = useState(null)
  const [managerId, setManagerId] = useState(null)
  const [certifications, setCertifications] = useState([])
  const [emailStatus, setEmailStatus] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(null)

  async function loadReferences() {
    setReferencesLoading(true)
    setReferencesError('')
    try {
      const [regionsResponse, categoriesResponse] = await Promise.all([
        http.get('/reference/regions'),
        http.get('/reference/categories'),
      ])
      setRegions(regionsResponse.data)
      setCategories(categoriesResponse.data)
    } catch {
      setReferencesError('Impossible de charger les régions et catégories. Réessayez.')
    } finally {
      setReferencesLoading(false)
    }
  }

  useEffect(() => {
    loadReferences()
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
    const { value } = event.target
    setForm((current) => ({ ...current, [field]: value }))
    clearFieldError(field)
    if (field === 'email') setEmailStatus(null)
  }

  function toggleValue(field, id) {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(id)
        ? current[field].filter((value) => value !== id)
        : [...current[field], id],
    }))
    clearFieldError(field)
  }

  async function checkEmail(value) {
    if (!emailIsValid(value)) {
      setEmailStatus(null)
      return null
    }

    setEmailStatus('checking')
    try {
      const { data } = await http.post('/auth/register/supplier/check-email', { email: value.trim() })
      setEmailStatus(data.available ? 'available' : 'taken')

      if (!data.available) {
        setFieldErrors((current) => ({
          ...current,
          email: [data.message ?? 'Cette adresse e-mail est déjà utilisée.'],
        }))
      }

      return data.available
    } catch {
      // Vérification impossible : le serveur tranchera à l'envoi du formulaire.
      setEmailStatus('error')
      return null
    }
  }

  function validateStepOne() {
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
    if (!form.password) {
      errors.password = ['Le mot de passe est obligatoire.']
    } else if (!passwordIsValid(form.password)) {
      errors.password = [
        'Mot de passe trop faible : 8 caractères minimum, une majuscule, une minuscule et un chiffre.',
      ]
    }
    if (form.password !== form.password_confirmation) {
      errors.password_confirmation = ['Les deux mots de passe ne correspondent pas.']
    }

    return errors
  }

  function validateStepTwo() {
    const errors = {}

    if (!form.company_name.trim()) errors.company_name = ["Le nom de l'entreprise est obligatoire."]
    if (!form.legal_form) errors.legal_form = ['La forme juridique est obligatoire.']
    if (!form.tax_id.trim()) errors.tax_id = ['Le matricule fiscal est obligatoire.']
    if (!form.rne_number.trim()) errors.rne_number = ['Le numéro RNE est obligatoire.']
    if (!form.sector.trim()) errors.sector = ['Le secteur d’activité est obligatoire.']
    if (!form.description.trim()) {
      errors.description = ["La description de l'entreprise est obligatoire."]
    }
    if (!form.region_id) errors.region_id = ['Sélectionnez la région du siège.']
    if (!form.address.trim()) errors.address = ["L'adresse est obligatoire."]
    if (!form.city.trim()) errors.city = ['La ville (délégation) est obligatoire.']
    if (!form.contact_name.trim()) {
      errors.contact_name = ['Le nom de la personne de contact est obligatoire.']
    }
    if (!form.contact_role.trim()) {
      errors.contact_role = ['La fonction de la personne de contact est obligatoire.']
    }
    if (!form.contact_phone.trim()) {
      errors.contact_phone = ['Le téléphone de la personne de contact est obligatoire.']
    }
    if (!form.coverage_regions.length) errors.coverage_regions = ['Sélectionnez au moins une zone couverte.']
    if (!form.categories.length) errors.categories = ['Sélectionnez au moins une catégorie proposée.']

    return errors
  }

  function validateStepThree() {
    const errors = {}

    const registerError = commercialRegister
      ? fileError(commercialRegister)
      : 'Le registre de commerce est obligatoire.'
    if (registerError) errors.commercial_register = [registerError]

    const taxError = taxCertificate
      ? fileError(taxCertificate)
      : "L'attestation fiscale est obligatoire."
    if (taxError) errors.tax_certificate = [taxError]

    const managerError = managerId ? fileError(managerId) : 'La CIN du gérant est obligatoire.'
    if (managerError) errors.manager_id = [managerError]

    // Les certifications sont optionnelles, mais contrôlées si présentes.
    const invalidFile = certifications.map(fileError).find(Boolean)
    if (invalidFile) errors.certifications = [invalidFile]

    return errors
  }

  async function goNext() {
    const errors = step === 1 ? validateStepOne() : validateStepTwo()
    setFieldErrors(errors)
    setError('')

    if (Object.keys(errors).length) return

    if (step === 1) {
      const available = await checkEmail(form.email)
      if (available === false) return
    }

    setStep((current) => current + 1)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (step < 3) {
      await goNext()
      return
    }

    const errors = validateStepThree()
    setFieldErrors(errors)
    setError('')
    if (Object.keys(errors).length) return

    setLoading(true)
    try {
      const payload = new FormData()
      payload.append('first_name', form.first_name.trim())
      payload.append('last_name', form.last_name.trim())
      payload.append('email', form.email.trim())
      payload.append('phone', `+216 ${form.phone.replace(/\s/g, '')}`)
      payload.append('password', form.password)
      payload.append('password_confirmation', form.password_confirmation)
      payload.append('company_name', form.company_name.trim())
      payload.append('legal_form', form.legal_form)
      payload.append('tax_id', form.tax_id.trim())
      payload.append('rne_number', form.rne_number.trim())
      payload.append('sector', form.sector.trim())
      payload.append('description', form.description.trim())
      payload.append('region_id', form.region_id)
      payload.append('address', form.address.trim())
      payload.append('city', form.city.trim())
      payload.append('contact_name', form.contact_name.trim())
      payload.append('contact_role', form.contact_role.trim())
      payload.append('contact_phone', form.contact_phone.trim())
      form.coverage_regions.forEach((id) => payload.append('coverage_regions[]', id))
      form.categories.forEach((id) => payload.append('categories[]', id))
      payload.append('commercial_register', commercialRegister)
      payload.append('tax_certificate', taxCertificate)
      payload.append('manager_id', managerId)
      certifications.forEach((file) => payload.append('certifications[]', file))

      const result = await registerSupplier(payload)
      setCreated(result)
    } catch (requestError) {
      const serverErrors = requestError.fieldErrors ?? {}
      setFieldErrors(serverErrors)
      setError(requestError.userMessage ?? 'Inscription impossible. Réessayez.')
      if (Object.keys(serverErrors).length) setStep(stepForErrors(serverErrors))
    } finally {
      setLoading(false)
    }
  }

  function handleRegisterFile(event) {
    setCommercialRegister(event.target.files?.[0] ?? null)
    clearFieldError('commercial_register')
  }

  function handleTaxCertificate(event) {
    setTaxCertificate(event.target.files?.[0] ?? null)
    clearFieldError('tax_certificate')
  }

  function handleManagerId(event) {
    setManagerId(event.target.files?.[0] ?? null)
    clearFieldError('manager_id')
  }

  function handleCertifications(event) {
    const files = Array.from(event.target.files ?? []).slice(0, 5)
    setCertifications(files)
    clearFieldError('certifications')
  }

  function removeCertification(index) {
    setCertifications((current) => current.filter((_, position) => position !== index))
  }

  const parentCategories = categories.filter((category) => !category.parent_id)
  const regionName = regions.find((region) => String(region.id) === String(form.region_id))?.name

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
            Votre profil <strong className="text-slate-900">{created.profile.company_name}</strong>{' '}
            est en attente de validation par un administrateur. Vous pourrez vendre dès qu&apos;il
            sera validé.
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
        <Link to={PATHS.home} className="text-sm text-brand-600">
          ← Accueil
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Inscription fournisseur</h1>
        <p className="mt-1 text-sm text-slate-500">
          Créez votre compte d&apos;entreprise en trois étapes. Vos données sont conservées d&apos;une
          étape à l&apos;autre.
        </p>

        <ol className="mt-6 flex items-center gap-2" aria-label="Étapes de l'inscription">
          {STEPS.map((item) => {
            const state =
              item.number === step ? 'current' : item.number < step ? 'done' : 'upcoming'

            return (
              <li key={item.number} className="flex-1">
                <div
                  className={[
                    'rounded-lg border px-3 py-2 text-center text-sm',
                    state === 'current' && 'border-brand-500 bg-brand-50 font-medium text-brand-700',
                    state === 'done' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                    state === 'upcoming' && 'border-slate-200 text-slate-400',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={state === 'current' ? 'step' : undefined}
                >
                  {item.number}. {item.title}
                </div>
              </li>
            )
          })}
        </ol>

        <form className="mt-6 space-y-4" noValidate onSubmit={handleSubmit}>
          {step === 1 && (
            <>
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
                  onBlur={(event) => checkEmail(event.target.value)}
                  aria-describedby="email-help"
                />
                <p id="email-help" className="mt-1 text-xs text-slate-500">
                  Elle servira d&apos;identifiant de connexion.
                </p>
                {emailStatus === 'checking' && (
                  <p className="mt-1 text-sm text-slate-500">Vérification de l&apos;adresse…</p>
                )}
                {emailStatus === 'available' && (
                  <p className="mt-1 text-sm text-emerald-600">Adresse e-mail disponible.</p>
                )}
                {emailStatus === 'error' && (
                  <p className="mt-1 text-sm text-amber-600">
                    Vérification momentanément indisponible.
                  </p>
                )}
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
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">8 chiffres, sans l&apos;indicatif.</p>
                {fieldErrors.phone && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.phone[0]}</p>
                )}
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
            </>
          )}

          {step === 2 && (
            <>
              {referencesError && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
                  {referencesError}{' '}
                  <button type="button" className="font-medium underline" onClick={loadReferences}>
                    Réessayer
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="company_name" className="mb-1 block text-sm font-medium">
                  Nom de l&apos;entreprise
                </label>
                <input
                  id="company_name"
                  type="text"
                  autoComplete="organization"
                  className="input"
                  required
                  value={form.company_name}
                  onChange={update('company_name')}
                />
                {fieldErrors.company_name && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.company_name[0]}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="legal_form" className="mb-1 block text-sm font-medium">
                    Forme juridique
                  </label>
                  <select
                    id="legal_form"
                    className="input"
                    required
                    value={form.legal_form}
                    onChange={update('legal_form')}
                  >
                    <option value="">Sélectionnez…</option>
                    {LEGAL_FORMS.map((form_) => (
                      <option key={form_} value={form_}>
                        {form_}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.legal_form && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.legal_form[0]}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="tax_id" className="mb-1 block text-sm font-medium">
                    Matricule fiscal
                  </label>
                  <input
                    id="tax_id"
                    type="text"
                    className="input"
                    required
                    value={form.tax_id}
                    onChange={update('tax_id')}
                  />
                  {fieldErrors.tax_id && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.tax_id[0]}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="rne_number" className="mb-1 block text-sm font-medium">
                  Numéro RNE (registre de commerce)
                </label>
                <input
                  id="rne_number"
                  type="text"
                  className="input"
                  required
                  value={form.rne_number}
                  onChange={update('rne_number')}
                />
                {fieldErrors.rne_number && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.rne_number[0]}</p>
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
                />
                {fieldErrors.sector && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.sector[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="description" className="mb-1 block text-sm font-medium">
                  Description de l&apos;entreprise
                </label>
                <textarea
                  id="description"
                  rows={3}
                  className="input"
                  required
                  value={form.description}
                  onChange={update('description')}
                />
                {fieldErrors.description && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.description[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="region_id" className="mb-1 block text-sm font-medium">
                  Région du siège
                </label>
                <select
                  id="region_id"
                  className="input"
                  required
                  value={form.region_id}
                  onChange={update('region_id')}
                  disabled={referencesLoading}
                >
                  <option value="">Sélectionnez une région</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.region_id && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.region_id[0]}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="address" className="mb-1 block text-sm font-medium">
                    Adresse
                  </label>
                  <input
                    id="address"
                    type="text"
                    autoComplete="street-address"
                    className="input"
                    required
                    value={form.address}
                    onChange={update('address')}
                  />
                  {fieldErrors.address && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.address[0]}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="city" className="mb-1 block text-sm font-medium">
                    Ville (délégation)
                  </label>
                  <input
                    id="city"
                    type="text"
                    className="input"
                    required
                    value={form.city}
                    onChange={update('city')}
                  />
                  {fieldErrors.city && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.city[0]}</p>
                  )}
                </div>
              </div>

              <fieldset className="space-y-4">
                <legend className="mb-2 text-sm font-medium">Personne de contact</legend>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contact_name" className="mb-1 block text-sm font-medium">
                      Nom et prénom
                    </label>
                    <input
                      id="contact_name"
                      type="text"
                      className="input"
                      required
                      value={form.contact_name}
                      onChange={update('contact_name')}
                    />
                    {fieldErrors.contact_name && (
                      <p className="mt-1 text-sm text-red-600">{fieldErrors.contact_name[0]}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="contact_role" className="mb-1 block text-sm font-medium">
                      Fonction
                    </label>
                    <input
                      id="contact_role"
                      type="text"
                      className="input"
                      required
                      value={form.contact_role}
                      onChange={update('contact_role')}
                    />
                    {fieldErrors.contact_role && (
                      <p className="mt-1 text-sm text-red-600">{fieldErrors.contact_role[0]}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="contact_phone" className="mb-1 block text-sm font-medium">
                    Téléphone du contact
                  </label>
                  <input
                    id="contact_phone"
                    type="tel"
                    className="input"
                    required
                    value={form.contact_phone}
                    onChange={update('contact_phone')}
                  />
                  {fieldErrors.contact_phone && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.contact_phone[0]}</p>
                  )}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">Zones couvertes</legend>
                {referencesLoading ? (
                  <p className="text-sm text-slate-500">Chargement des régions…</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {regions.map((region) => (
                      <label key={region.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          value={region.id}
                          checked={form.coverage_regions.includes(region.id)}
                          onChange={() => toggleValue('coverage_regions', region.id)}
                        />
                        {region.name}
                      </label>
                    ))}
                  </div>
                )}
                {fieldErrors.coverage_regions && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.coverage_regions[0]}</p>
                )}
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">Catégories proposées</legend>
                {referencesLoading ? (
                  <p className="text-sm text-slate-500">Chargement des catégories…</p>
                ) : (
                  <div className="space-y-3">
                    {parentCategories.map((parent) => {
                      const children = categories.filter(
                        (category) => category.parent_id === parent.id,
                      )

                      return (
                        <div key={parent.id}>
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              value={parent.id}
                              checked={form.categories.includes(parent.id)}
                              onChange={() => toggleValue('categories', parent.id)}
                            />
                            {parent.name}
                          </label>
                          {children.length > 0 && (
                            <div className="mt-1 grid grid-cols-2 gap-2 pl-6 sm:grid-cols-3">
                              {children.map((child) => (
                                <label key={child.id} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    value={child.id}
                                    checked={form.categories.includes(child.id)}
                                    onChange={() => toggleValue('categories', child.id)}
                                  />
                                  {child.name}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {fieldErrors.categories && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.categories[0]}</p>
                )}
              </fieldset>
            </>
          )}

          {step === 3 && (
            <>
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p>
                  <span className="font-medium text-slate-900">{form.company_name}</span> —{' '}
                  {form.email}
                </p>
                <p>
                  {regionName ?? 'Région non renseignée'} · {form.coverage_regions.length} zone(s) ·
                  {' '}
                  {form.categories.length} catégorie(s)
                </p>
              </div>

              <div>
                <label htmlFor="commercial_register" className="mb-1 block text-sm font-medium">
                  Registre de commerce
                </label>
                <input
                  id="commercial_register"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="block w-full text-sm text-slate-600"
                  onChange={handleRegisterFile}
                />
                <p className="mt-1 text-xs text-slate-500">PDF, JPG ou PNG — 5 Mo maximum.</p>
                {commercialRegister && (
                  <p className="mt-1 text-sm text-slate-700">Fichier choisi : {commercialRegister.name}</p>
                )}
                {fieldErrors.commercial_register && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.commercial_register[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="tax_certificate" className="mb-1 block text-sm font-medium">
                  Attestation fiscale / patente
                </label>
                <input
                  id="tax_certificate"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="block w-full text-sm text-slate-600"
                  onChange={handleTaxCertificate}
                />
                <p className="mt-1 text-xs text-slate-500">PDF, JPG ou PNG — 5 Mo maximum.</p>
                {taxCertificate && (
                  <p className="mt-1 text-sm text-slate-700">Fichier choisi : {taxCertificate.name}</p>
                )}
                {fieldErrors.tax_certificate && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.tax_certificate[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="manager_id" className="mb-1 block text-sm font-medium">
                  CIN du gérant
                </label>
                <input
                  id="manager_id"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="block w-full text-sm text-slate-600"
                  onChange={handleManagerId}
                />
                <p className="mt-1 text-xs text-slate-500">PDF, JPG ou PNG — 5 Mo maximum.</p>
                {managerId && (
                  <p className="mt-1 text-sm text-slate-700">Fichier choisi : {managerId.name}</p>
                )}
                {fieldErrors.manager_id && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.manager_id[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="certifications" className="mb-1 block text-sm font-medium">
                  Certifications (facultatif)
                </label>
                <input
                  id="certifications"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  className="block w-full text-sm text-slate-600"
                  onChange={handleCertifications}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Facultatif : jusqu&apos;à cinq certifications, PDF, JPG ou PNG — 5 Mo maximum par
                  fichier.
                </p>
                {certifications.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {certifications.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                        <span>{file.name}</span>
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => removeCertification(index)}
                          aria-label={`Retirer ${file.name}`}
                        >
                          Retirer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {fieldErrors.certifications && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.certifications[0]}</p>
                )}
                {Object.keys(fieldErrors)
                  .filter((key) => key.startsWith('certifications.'))
                  .map((key) => (
                    <p key={key} className="mt-1 text-sm text-red-600">
                      {fieldErrors[key][0]}
                    </p>
                  ))}
              </div>

              <p className="text-xs text-slate-500">
                Votre profil sera créé en statut « en attente ». Un e-mail de vérification sera
                envoyé et un administrateur validera vos justificatifs.
              </p>
            </>
          )}

          {error && !Object.keys(fieldErrors).length && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            {step > 1 ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setStep((current) => current - 1)
                  setError('')
                  setFieldErrors({})
                }}
              >
                Retour
              </button>
            ) : (
              <Link to={PATHS.login} className="btn-ghost">
                Annuler
              </Link>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || (step === 1 && emailStatus === 'checking')}
            >
              {step < 3 ? 'Continuer' : loading ? 'Envoi…' : 'Créer mon compte'}
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
