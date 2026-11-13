import { useRef, useState } from 'react'
import StatusBadge from '@/components/StatusBadge'
import { DOCUMENT_ACCEPT, DOCUMENT_TYPES, documentFileError } from '@/utils/supplierDocuments'
import { FieldError, inputClass } from './Field'

/**
 * Documents justificatifs : liste + statut par document, et ajout d'un document
 * (envoyé dès la sélection du fichier, il arrive « en attente »).
 */
export default function DocumentsCard({ documents, adding, errors, onAdd, onOpen, onLocalError }) {
  const [type, setType] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const input = useRef(null)

  function chooseFile() {
    if (!type) {
      onLocalError({ type: ['Choisissez le type de document.'] })
      return
    }
    input.current?.click()
  }

  async function handleChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const fileError = documentFileError(file)
    if (fileError) {
      onLocalError({ file: [fileError] })
      return
    }
    const added = await onAdd(type, file)
    if (added) {
      setType('')
      setFormOpen(false)
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5" aria-labelledby="documents-title">
      <h2 id="documents-title" className="mb-4 text-lg font-semibold text-ink">
        Documents justificatifs
      </h2>

      {documents.length === 0 ? (
        <p className="text-sm text-muted">Aucun document pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="min-w-0 truncate text-left text-[15px] text-brand-600 hover:underline"
                onClick={() => onOpen(document)}
              >
                {document.file_name}
              </button>
              <StatusBadge status={document.status} />
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <div className="mt-4">
          <label htmlFor="document_type" className="mb-2 block text-sm font-medium text-ink">
            Type de document
          </label>
          <select
            id="document_type"
            className={inputClass}
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">Choisir le type</option>
            {DOCUMENT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError messages={errors?.type} />
          <p className="mt-2 text-xs text-muted">PDF, JPG ou PNG, 5 Mo maximum.</p>
        </div>
      )}
      <FieldError messages={errors?.file} />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={adding}
          onClick={formOpen ? chooseFile : () => setFormOpen(true)}
        >
          {adding ? 'Envoi…' : formOpen ? 'Choisir le fichier' : 'Ajouter un document'}
        </button>
        {formOpen && !adding && (
          <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>
            Annuler
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={DOCUMENT_ACCEPT}
        className="sr-only"
        aria-label="Choisir un document"
        onChange={handleChange}
      />
    </section>
  )
}
