import { useRef, useState } from 'react'
import StatusBadge from '@/components/StatusBadge'
import { FieldError, inputClass } from './Field'

// Mêmes valeurs que SupplierDocument::TYPE_* côté Laravel.
const DOCUMENT_TYPES = [
  { value: 'registre de commerce', label: 'Registre de commerce' },
  { value: 'attestation fiscale', label: 'Attestation fiscale' },
  { value: 'cin gerant', label: 'CIN du gérant' },
  { value: 'certification', label: 'Certification' },
]

const ACCEPTED = 'application/pdf,image/jpeg,image/png'
const MAX_BYTES = 5 * 1024 * 1024

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
    if (!ACCEPTED.split(',').includes(file.type)) {
      onLocalError({ file: ['Le document doit être un PDF ou une image (JPG, PNG).'] })
      return
    }
    if (file.size > MAX_BYTES) {
      onLocalError({ file: ['Le document ne doit pas dépasser 5 Mo.'] })
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
        accept={ACCEPTED}
        className="sr-only"
        aria-label="Choisir un document"
        onChange={handleChange}
      />
    </section>
  )
}
