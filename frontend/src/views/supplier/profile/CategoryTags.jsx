import { useMemo, useState } from 'react'
import { FieldError, inputClass } from './Field'

/**
 * Catégories proposées : étiquettes retirables + « + Ajouter » (liste groupée par catégorie parente).
 * Ces catégories servent à la diffusion des demandes aux fournisseurs concernés.
 */
export default function CategoryTags({ categories, selectedIds, errors, onChange }) {
  const [adding, setAdding] = useState(false)

  const byId = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const groups = useMemo(() => {
    const parents = categories.filter((category) => category.parent_id === null)
    return parents.map((parent) => ({
      parent,
      children: categories.filter((category) => category.parent_id === parent.id),
    }))
  }, [categories])

  const available = (category) => !selectedIds.includes(category.id)

  function add(event) {
    const id = Number(event.target.value)
    if (id) onChange([...selectedIds, id])
    setAdding(false)
  }

  return (
    <fieldset>
      <legend className="mb-3 text-lg font-semibold text-ink">Catégories proposées</legend>

      <ul className="flex flex-wrap items-center gap-2" aria-label="Catégories sélectionnées">
        {selectedIds.map((id) => (
          <li key={id} className="inline-flex items-center gap-1 rounded-full bg-info-soft py-1 pr-1.5 pl-3 text-[13px] text-info">
            {byId.get(id)?.name ?? `Catégorie ${id}`}
            <button
              type="button"
              className="grid h-5 w-5 place-items-center rounded-full hover:bg-info/15"
              aria-label={`Retirer ${byId.get(id)?.name ?? 'la catégorie'}`}
              onClick={() => onChange(selectedIds.filter((selected) => selected !== id))}
            >
              ×
            </button>
          </li>
        ))}

        <li>
          {adding ? (
            <select
              autoFocus
              aria-label="Ajouter une catégorie"
              className={`${inputClass} w-auto py-1.5 text-sm`}
              defaultValue=""
              onChange={add}
              onBlur={() => setAdding(false)}
            >
              <option value="">Choisir une catégorie</option>
              {groups.map(({ parent, children }) => (
                <optgroup key={parent.id} label={parent.name}>
                  {available(parent) && <option value={parent.id}>{parent.name} (toute la catégorie)</option>}
                  {children.filter(available).map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          ) : (
            <button
              type="button"
              className="rounded-full bg-page px-3 py-1 text-[13px] text-muted hover:text-ink"
              onClick={() => setAdding(true)}
            >
              + Ajouter
            </button>
          )}
        </li>
      </ul>

      <FieldError messages={errors} />
    </fieldset>
  )
}
