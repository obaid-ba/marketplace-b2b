import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { fetchOrderDispute, openDispute } from '@/api/disputes'
import PageHeader from '@/components/PageHeader'
import { disputePath, orderTrackingPath } from '@/router/paths'
import { formatFileSize } from '@/views/messaging/messageUtils'

const MAX_FILES = 5
const MAX_MB = 5
const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf']
const MIN_DESCRIPTION = 20

function fileProblem(file) {
  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
  if (!EXTENSIONS.includes(extension)) return `« ${file.name} » : formats acceptés JPG, PNG, WebP et PDF.`
  if (file.size > MAX_MB * 1024 * 1024) return `« ${file.name} » dépasse ${MAX_MB} Mo.`
  return null
}

/** « Signaler un problème » sur une commande (SCRUM-117 / F23). */
export default function NewDisputePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let active = true
    fetchOrderDispute(id)
      .then((data) => active && setState(data))
      .catch((err) => active && setLoadError(err.response?.status === 404 ? 'Commande introuvable.' : (err.userMessage ?? 'Chargement impossible.')))
    return () => {
      active = false
    }
  }, [id])

  function addFiles(event) {
    const chosen = [...event.target.files]
    event.target.value = ''
    const problem = chosen.map(fileProblem).find(Boolean) ?? (files.length + chosen.length > MAX_FILES ? `${MAX_FILES} fichiers au maximum.` : null)
    setErrors((current) => ({ ...current, files: problem }))
    if (!problem) setFiles((current) => [...current, ...chosen])
  }

  async function submit(event) {
    event.preventDefault()
    const text = description.trim()
    const problems = {
      reason: reason ? null : 'Choisissez le motif du problème.',
      description: text.length >= MIN_DESCRIPTION ? null : `Décrivez le problème en ${MIN_DESCRIPTION} caractères au moins.`,
    }
    setErrors(problems)
    if (problems.reason || problems.description) return

    setSending(true)
    try {
      const dispute = await openDispute(id, { reason, description: text, files })
      navigate(disputePath(dispute.id), { replace: true })
    } catch (err) {
      const fields = err.fieldErrors ?? {}
      const fileError = Object.entries(fields).find(([key]) => key.startsWith('attachments'))?.[1]?.[0]
      const known = { reason: fields.reason?.[0], description: fields.description?.[0], files: fileError }
      setErrors({ ...known, form: Object.values(known).some(Boolean) ? null : (err.userMessage ?? "Le litige n'a pas pu être ouvert.") })
      setSending(false)
    }
  }

  if (loadError || (state && !state.can_open)) {
    return (
      <div className="card text-center">
        <p className="font-semibold text-ink">{loadError ?? 'Un problème ne peut pas être signalé sur cette commande.'}</p>
        {!loadError && (
          <p className="mt-1 text-sm text-muted">
            {state.dispute ? 'Un litige existe déjà.' : "C'est possible de l'expédition à la livraison, avant de confirmer la réception."}
          </p>
        )}
        <div className="mt-4 flex justify-center gap-3">
          {state?.dispute && (
            <Link to={disputePath(state.dispute.id)} className="btn-primary">
              Voir le litige
            </Link>
          )}
          <Link to={orderTrackingPath(id)} className="btn-secondary">
            Retour à la commande
          </Link>
        </div>
      </div>
    )
  }
  if (!state) return <div className="card text-sm text-muted">Chargement…</div>

  return (
    <div className="max-w-2xl">
      <PageHeader title="Signaler un problème" subtitle={`Commande n° ${id}. Le fournisseur et un administrateur seront prévenus.`} />

      <form onSubmit={submit} noValidate className="card space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Motif</legend>
          <div className="space-y-2">
            {state.reasons.map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm text-ink">
                <input type="radio" name="reason" className="accent-brand-600" checked={reason === item} onChange={() => setReason(item)} />
                {item}
              </label>
            ))}
          </div>
          {errors.reason && <p className="mt-1 text-sm text-danger">{errors.reason}</p>}
        </fieldset>

        <div>
          <label htmlFor="dispute-description" className="mb-1 block text-sm font-medium text-ink">
            Que s'est-il passé ?
          </label>
          <textarea
            id="dispute-description"
            rows={6}
            maxLength={3000}
            className="input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Articles concernés, état à la réception, échanges avec le fournisseur…"
          />
          {errors.description && <p className="mt-1 text-sm text-danger">{errors.description}</p>}
        </div>

        <div>
          <label htmlFor="dispute-files" className="mb-1 block text-sm font-medium text-ink">
            Photos ou documents (facultatif)
          </label>
          <p className="mb-2 text-xs text-muted">
            JPG, PNG, WebP ou PDF · {MAX_FILES} fichiers au maximum · {MAX_MB} Mo chacun
          </p>
          <input
            id="dispute-files"
            type="file"
            multiple
            accept={EXTENSIONS.map((extension) => `.${extension}`).join(',')}
            onChange={addFiles}
            className="block w-full text-sm text-muted"
          />
          {files.length > 0 && (
            <ul className="mt-3 space-y-1">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-page px-3 py-2 text-sm text-ink">
                  <span className="truncate">
                    {file.name} <span className="text-muted">({formatFileSize(file.size)})</span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-danger hover:underline"
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Retirer ${file.name}`}
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
          {errors.files && <p className="mt-1 text-sm text-danger">{errors.files}</p>}
        </div>

        {errors.form && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.form}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Link to={orderTrackingPath(id)} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary" disabled={sending}>
            {sending ? 'Envoi…' : 'Ouvrir le litige'}
          </button>
        </div>
      </form>
    </div>
  )
}
