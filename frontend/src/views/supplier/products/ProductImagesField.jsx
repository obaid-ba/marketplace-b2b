import { useRef, useState } from 'react'

/**
 * Photos d'un produit (SCRUM-33, maquette F3) : 4 vignettes au plus, la première est l'image principale.
 * Ajout par clic ou glisser-déposer de fichiers ; réordonnancement par glisser-déposer des vignettes
 * (ou boutons ← → au clavier).
 *
 * items : [{ key, url, file? (nouvelle photo pas encore envoyée), id? (photo enregistrée) }]
 */
export const MAX_IMAGES = 4
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

let localKey = 0

/** Filtre les fichiers choisis : formats, poids, nombre maximal. Renvoie { accepted, errors }. */
export function checkFiles(files, currentCount) {
  const accepted = []
  const errors = []
  for (const file of files) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      errors.push(`« ${file.name} » n'est pas une image JPG, PNG ou WebP.`)
    } else if (file.size > MAX_IMAGE_BYTES) {
      errors.push(`« ${file.name} » dépasse 3 Mo.`)
    } else if (currentCount + accepted.length >= MAX_IMAGES) {
      errors.push(`${MAX_IMAGES} photos au maximum : « ${file.name} » n'a pas été ajoutée.`)
    } else {
      accepted.push(file)
    }
  }
  return { accepted, errors }
}

export default function ProductImagesField({ items, onChange, error }) {
  const inputRef = useRef(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [dropZoneActive, setDropZoneActive] = useState(false)
  const [localErrors, setLocalErrors] = useState([])

  function addFiles(fileList) {
    const { accepted, errors } = checkFiles([...fileList], items.length)
    setLocalErrors(errors)
    if (accepted.length) {
      onChange([
        ...items,
        ...accepted.map((file) => ({ key: `local-${++localKey}`, file, url: URL.createObjectURL(file) })),
      ])
    }
  }

  function move(from, to) {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  function remove(index) {
    const item = items[index]
    if (item.file) URL.revokeObjectURL(item.url)
    onChange(items.filter((_, i) => i !== index))
  }

  const full = items.length >= MAX_IMAGES

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Photos du produit">
          {items.map((item, index) => (
            <li
              key={item.key}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => dragIndex !== null && event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                if (dragIndex !== null) move(dragIndex, index)
                setDragIndex(null)
              }}
              className={`group relative aspect-[3/2] cursor-grab overflow-hidden rounded-xl bg-brand-50 ${
                dragIndex === index ? 'opacity-50' : ''
              }`}
            >
              <img src={item.url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
              <span className="absolute top-2 left-2 rounded-full bg-surface/90 px-2 py-0.5 text-xs font-medium text-brand-600">
                {index === 0 ? 'Principale' : `Photo ${index + 1}`}
              </span>
              <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1">
                <span className="flex gap-1">
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-md bg-surface/90 text-sm text-ink disabled:opacity-40"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Déplacer la photo ${index + 1} vers la gauche`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-md bg-surface/90 text-sm text-ink disabled:opacity-40"
                    onClick={() => move(index, index + 1)}
                    disabled={index === items.length - 1}
                    aria-label={`Déplacer la photo ${index + 1} vers la droite`}
                  >
                    →
                  </button>
                </span>
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-md bg-surface/90 text-sm text-danger"
                  onClick={() => remove(index)}
                  aria-label={`Supprimer la photo ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={full}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          if (event.dataTransfer?.types?.includes('Files')) {
            event.preventDefault()
            setDropZoneActive(true)
          }
        }}
        onDragLeave={() => setDropZoneActive(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDropZoneActive(false)
          if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files)
        }}
        className={`flex w-full flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
          dropZoneActive ? 'border-brand-600 bg-brand-50' : 'border-line bg-page hover:border-brand-500'
        }`}
      >
        <span className="text-[15px] font-medium text-ink">
          {full ? `${MAX_IMAGES} photos au maximum` : 'Ajouter des images'}
        </span>
        <span className="text-xs text-muted">JPG, PNG ou WebP, 3 Mo max - réorganisez par glisser-déposer</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Choisir des images"
        onChange={(event) => {
          if (event.target.files?.length) addFiles(event.target.files)
          event.target.value = ''
        }}
      />

      {[...localErrors, ...(error ? [error] : [])].map((message) => (
        <p key={message} role="alert" className="text-xs text-danger">
          {message}
        </p>
      ))}
    </div>
  )
}
