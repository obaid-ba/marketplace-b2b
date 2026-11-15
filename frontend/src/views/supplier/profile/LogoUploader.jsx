import { useRef } from 'react'
import { initialsOf } from '@/utils/initials'
import { FieldError } from './Field'

const ACCEPTED = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 2 * 1024 * 1024

/** Logo de l'entreprise : envoyé dès la sélection du fichier. Initiales si aucun logo. */
export default function LogoUploader({ logoUrl, companyName, uploading, errors, onUpload, onLocalError }) {
  const input = useRef(null)

  function handleChange(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // permet de choisir à nouveau le même fichier
    if (!file) return
    if (!ACCEPTED.split(',').includes(file.type)) {
      onLocalError('Le logo doit être une image (JPG, PNG ou WebP).')
      return
    }
    if (file.size > MAX_BYTES) {
      onLocalError('Le logo ne doit pas dépasser 2 Mo.')
      return
    }
    onUpload(file)
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        {logoUrl ? (
          <img src={logoUrl} alt={`Logo de ${companyName}`} className="h-[72px] w-[72px] rounded-full border border-line object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-brand-50 text-2xl font-semibold text-brand-600"
          >
            {initialsOf(companyName)}
          </span>
        )}
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Logo de l’entreprise</p>
          <button type="button" className="btn-secondary" disabled={uploading} onClick={() => input.current?.click()}>
            {uploading ? 'Envoi…' : 'Changer le logo'}
          </button>
          <input
            ref={input}
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            aria-label="Choisir un logo"
            onChange={handleChange}
          />
        </div>
      </div>
      <FieldError messages={errors} />
    </div>
  )
}
