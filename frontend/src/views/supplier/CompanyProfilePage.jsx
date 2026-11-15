import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import PageHeader from '@/components/PageHeader'
import {
  addSupplierDocument,
  fetchProfileReferences,
  fetchSupplierProfile,
  openSupplierDocument,
  setSupplierProfilePublished,
  updateSupplierProfile,
  uploadSupplierLogo,
} from '@/api/supplierProfile'
import { supplierPublicPath } from '@/router/paths'
import { selectUser, useAuthStore } from '@/stores/auth'
import CategoryTags from './profile/CategoryTags'
import CompanyInfoForm from './profile/CompanyInfoForm'
import CoverageZones from './profile/CoverageZones'
import DocumentsCard from './profile/DocumentsCard'
import LogoUploader from './profile/LogoUploader'
import ReputationCard from './profile/ReputationCard'
import ValidationCard from './profile/ValidationCard'

/** Valeurs du formulaire à partir du profil renvoyé par l'API. */
function formFromProfile(profile) {
  return {
    company_name: profile.company_name ?? '',
    description: profile.description ?? '',
    sector: profile.sector ?? '',
    region_id: profile.region_id ? String(profile.region_id) : '',
    professional_phone: profile.professional_phone ?? '',
    professional_email: profile.professional_email ?? '',
    categories: (profile.categories ?? []).map((category) => category.id),
    coverage_regions: (profile.coverage_regions ?? []).map((region) => region.id),
  }
}

/** Erreurs d'un tableau : « categories » ou la première erreur d'un élément (« categories.0 »). */
function arrayErrors(errors, field) {
  if (errors[field]) return errors[field]
  const key = Object.keys(errors).find((name) => name.startsWith(`${field}.`))
  return key ? errors[key] : undefined
}

/**
 * Profil de l'entreprise (SCRUM-28, maquette F9).
 * Un fournisseur non validé peut compléter son profil, mais pas le publier.
 */
export default function CompanyProfilePage() {
  const user = useAuthStore(selectUser)
  const setUser = useAuthStore((state) => state.setUser)

  const [status, setStatus] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState('')
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(null)
  const [references, setReferences] = useState({ regions: [], categories: [], sectors: [] })

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null) // { type: 'success' | 'error', text }

  const [logoUploading, setLogoUploading] = useState(false)
  const [logoErrors, setLogoErrors] = useState()
  const [publishing, setPublishing] = useState(false)
  const [publishErrors, setPublishErrors] = useState()
  const [documentAdding, setDocumentAdding] = useState(false)
  const [documentErrors, setDocumentErrors] = useState()

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchSupplierProfile(), fetchProfileReferences()])
      .then(([loadedProfile, loadedReferences]) => {
        if (cancelled) return
        setProfile(loadedProfile)
        setForm(formFromProfile(loadedProfile))
        setReferences(loadedReferences)
        setStatus('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(error.userMessage ?? 'Impossible de charger le profil.')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  /** Garde l'en-tête de l'espace à jour si le nom de l'entreprise change. */
  function syncHeader(updated) {
    if (user && user.supplier_company_name !== updated.company_name) {
      setUser({ ...user, supplier_company_name: updated.company_name })
    }
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    setNotice(null)
    try {
      const { message, profile: updated } = await updateSupplierProfile({
        ...form,
        region_id: form.region_id ? Number(form.region_id) : null,
      })
      setProfile(updated)
      setForm(formFromProfile(updated))
      syncHeader(updated)
      setNotice({ type: 'success', text: message })
    } catch (error) {
      // Les saisies restent dans le formulaire : rien n'est perdu en cas d'échec.
      setErrors(error.fieldErrors ?? {})
      setNotice({ type: 'error', text: error.userMessage ?? 'Le profil n’a pas pu être enregistré.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleLogo(file) {
    setLogoUploading(true)
    setLogoErrors(undefined)
    try {
      const { profile: updated } = await uploadSupplierLogo(file)
      setProfile((current) => ({ ...current, logo_url: updated.logo_url }))
    } catch (error) {
      setLogoErrors(error.fieldErrors?.logo ?? [error.userMessage])
    } finally {
      setLogoUploading(false)
    }
  }

  async function handlePublish(isPublished) {
    setPublishing(true)
    setPublishErrors(undefined)
    try {
      const { profile: updated } = await setSupplierProfilePublished(isPublished)
      setProfile((current) => ({ ...current, is_published: updated.is_published, can_publish: updated.can_publish }))
    } catch (error) {
      setPublishErrors(error.fieldErrors?.is_published ?? [error.userMessage])
    } finally {
      setPublishing(false)
    }
  }

  async function handleAddDocument(type, file) {
    setDocumentAdding(true)
    setDocumentErrors(undefined)
    try {
      const { document } = await addSupplierDocument(type, file)
      setProfile((current) => ({ ...current, documents: [document, ...(current.documents ?? [])] }))
      return true
    } catch (error) {
      setDocumentErrors(Object.keys(error.fieldErrors ?? {}).length ? error.fieldErrors : { file: [error.userMessage] })
      return false
    } finally {
      setDocumentAdding(false)
    }
  }

  async function handleOpenDocument(document) {
    setDocumentErrors(undefined)
    try {
      await openSupplierDocument(document)
    } catch (error) {
      setDocumentErrors({ file: [error.userMessage ?? 'Le document n’a pas pu être ouvert.'] })
    }
  }

  if (status === 'loading') {
    return (
      <p role="status" className="text-muted">
        Chargement du profil…
      </p>
    )
  }

  if (status === 'error') {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-6">
        <p className="text-danger">{loadError}</p>
        <button type="button" className="btn-secondary mt-4" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} noValidate>
      <PageHeader
        title="Profil de l’entreprise"
        subtitle="Ces informations sont visibles sur votre fiche fournisseur publique"
        actions={
          <>
            {/* TODO SCRUM-37 : la fiche fournisseur publique arrive en S2. */}
            <Link to={supplierPublicPath(profile.id)} target="_blank" rel="noopener" className="btn-secondary px-5 py-2.5">
              Voir ma fiche publique
            </Link>
            <button type="submit" className="btn-primary px-5 py-2.5" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </>
        }
      />

      {notice && (
        <p
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${
            notice.type === 'error' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,390px)]">
        <section className="space-y-6 rounded-xl border border-line bg-surface p-6" aria-label="Informations de l'entreprise">
          <LogoUploader
            logoUrl={profile.logo_url}
            companyName={form.company_name || profile.company_name}
            uploading={logoUploading}
            errors={logoErrors}
            onUpload={handleLogo}
            onLocalError={(message) => setLogoErrors([message])}
          />

          <CompanyInfoForm
            form={form}
            errors={errors}
            sectors={references.sectors}
            regions={references.regions}
            onChange={updateField}
          />

          <CategoryTags
            categories={references.categories}
            selectedIds={form.categories}
            errors={arrayErrors(errors, 'categories')}
            onChange={(ids) => updateField('categories', ids)}
          />

          <CoverageZones
            regions={references.regions}
            selectedIds={form.coverage_regions}
            errors={arrayErrors(errors, 'coverage_regions')}
            onChange={(ids) => updateField('coverage_regions', ids)}
          />
        </section>

        <aside className="space-y-5">
          <ValidationCard profile={profile} toggling={publishing} errors={publishErrors} onToggle={handlePublish} />
          <DocumentsCard
            documents={profile.documents ?? []}
            adding={documentAdding}
            errors={documentErrors}
            onAdd={handleAddDocument}
            onOpen={handleOpenDocument}
            onLocalError={setDocumentErrors}
          />
          <ReputationCard rating={profile.rating_avg} count={profile.reviews_count} />
        </aside>
      </div>
    </form>
  )
}
