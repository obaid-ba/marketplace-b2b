import { useState } from 'react'
import { addSupplierDocument } from '@/api/supplierProfile'
import { DOCUMENT_ACCEPT, DOCUMENT_TYPES, documentFileError } from '@/utils/supplierDocuments'
import { FieldError, inputClass } from '../profile/Field'

/**
 * « Renvoyer mes documents » après un refus (SCRUM-27) : type + fichier.
 * L'API repasse alors le dossier « en attente » ; onSubmitted reçoit la réponse ({ message, … }).
 */
export default function ResubmitDocumentsForm({ onSubmitted }) {
  const [type, setType] = useState('')
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)

  function handleFile(event) {
    const chosen = event.target.files?.[0] ?? null
    const fileError = chosen ? documentFileError(chosen) : null
    setErrors((current) => ({ ...current, file: fileError ? [fileError] : undefined }))
    setFile(fileError ? null : chosen)
    if (fileError) event.target.value = ''
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const local = {}
    if (!type) local.type = ['Choisissez le type de document.']
    if (!file) local.file = errors.file ?? ['Choisissez un fichier.']
    setErrors(local)
    setFormError(null)
    if (Object.keys(local).length) return

    setSending(true)
    try {
      const result = await addSupplierDocument(type, file)
      onSubmitted(result)
    } catch (error) {
      setErrors(error.fieldErrors ?? {})
      if (!Object.keys(error.fieldErrors ?? {}).length) setFormError(error.userMessage ?? 'Envoi impossible.')
      setSending(false)
    }
  }

  return (
    <form className="mt-6 rounded-xl border border-line p-4" noValidate onSubmit={handleSubmit} aria-labelledby="resubmit-title">
      <h2 id="resubmit-title" className="text-base font-semibold text-ink">
        Renvoyer mes documents
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        Corrigez le point signalé puis envoyez le nouveau document : votre dossier repassera en cours d’examen.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="resubmit-type" className="mb-2 block text-sm font-medium text-ink">
            Type de document
          </label>
          <select
            id="resubmit-type"
            className={inputClass}
            value={type}
            aria-invalid={errors.type ? true : undefined}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">Choisir le type</option>
            {DOCUMENT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError messages={errors.type} />
        </div>

        <div>
          <label htmlFor="resubmit-file" className="mb-2 block text-sm font-medium text-ink">
            Fichier
          </label>
          <input
            id="resubmit-file"
            type="file"
            accept={DOCUMENT_ACCEPT}
            aria-invalid={errors.file ? true : undefined}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-page"
            onChange={handleFile}
          />
          <FieldError messages={errors.file} />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">PDF, JPG ou PNG, 5 Mo maximum.</p>

      {formError && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {formError}
        </p>
      )}

      <button type="submit" className="btn-secondary mt-4 w-full sm:w-auto" disabled={sending}>
        {sending ? 'Envoi…' : 'Envoyer le document'}
      </button>
    </form>
  )
}
