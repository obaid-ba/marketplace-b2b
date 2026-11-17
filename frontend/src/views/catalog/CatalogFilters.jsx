import { useEffect, useState } from 'react'
import { DELAY_OPTIONS, RATING_OPTIONS, TYPE_OPTIONS } from './catalogParams'

/**
 * Colonne de filtres du catalogue (maquette V2 + filtres Délai et Note exigés par SCRUM-35).
 * Cases et boutons radio : effet immédiat. Prix : appliqué 400 ms après la saisie, ou à la validation.
 */

const VISIBLE_REGIONS = 4

function Section({ title, children }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-[15px] font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  )
}

function Checkbox({ checked, onChange, children, disabled }) {
  return (
    <label className={`flex items-center gap-2.5 text-[15px] text-ink ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-line accent-brand-600"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  )
}

function Radio({ name, checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[15px] text-ink">
      <input type="radio" name={name} className="h-4 w-4 accent-brand-600" checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  )
}

const toggle = (values, value, on) => (on ? [...new Set([...values, value])] : values.filter((v) => v !== value))

function PriceField({ id, label, value, onCommit }) {
  const [draft, setDraft] = useState(value)

  useEffect(() => setDraft(value), [value])

  // Saisie : application automatique après 400 ms sans frappe.
  useEffect(() => {
    if (draft === value) return undefined
    const timer = setTimeout(() => onCommit(draft), 400)
    return () => clearTimeout(timer)
  }, [draft, value, onCommit])

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="0"
        inputMode="decimal"
        className="w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onCommit(draft)
        }}
        onBlur={() => draft !== value && onCommit(draft)}
      />
    </div>
  )
}

export default function CatalogFilters({ filters, categories, regions, onChange, onReset, idPrefix = 'f' }) {
  const [expanded, setExpanded] = useState(() => new Set())
  const [showAllRegions, setShowAllRegions] = useState(false)

  const selectedRegions = new Set(filters.region)
  const sortedRegions = [...regions].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const visibleRegions = showAllRegions
    ? sortedRegions
    : [
        ...sortedRegions.filter((r) => selectedRegions.has(String(r.id))),
        ...sortedRegions.filter((r) => !selectedRegions.has(String(r.id))),
      ].slice(0, Math.max(VISIBLE_REGIONS, selectedRegions.size))

  // Type : les deux cochées = pas de filtre (aucune valeur dans l'URL).
  const typeChecked = (value) => filters.type.length === 0 || filters.type.includes(value)
  function changeType(value, on) {
    const current = filters.type.length === 0 ? TYPE_OPTIONS.map((t) => t.value) : filters.type
    const next = toggle(current, value, on)
    onChange({ type: next.length === TYPE_OPTIONS.length ? [] : next })
  }

  return (
    <div className="space-y-6">
      <Section title="Catégorie">
        {categories.map((category) => {
          const id = String(category.id)
          const isOpen = expanded.has(category.id)
          const hasChildren = category.children?.length > 0
          return (
            <div key={category.id}>
              <div className="flex items-center justify-between gap-2">
                <Checkbox
                  checked={filters.category.includes(id)}
                  onChange={(on) => onChange({ category: toggle(filters.category, id, on) })}
                >
                  {category.name}
                </Checkbox>
                {hasChildren && (
                  <button
                    type="button"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:bg-page"
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Masquer' : 'Afficher'} les sous-catégories de ${category.name}`}
                    onClick={() =>
                      setExpanded((set) => {
                        const next = new Set(set)
                        if (next.has(category.id)) next.delete(category.id)
                        else next.add(category.id)
                        return next
                      })
                    }
                  >
                    <span aria-hidden="true" className={`text-xs transition ${isOpen ? 'rotate-180' : ''}`}>
                      ▾
                    </span>
                  </button>
                )}
              </div>
              {hasChildren && isOpen && (
                <div className="mt-2 space-y-2 pl-6">
                  {category.children.map((child) => (
                    <Checkbox
                      key={child.id}
                      checked={filters.category.includes(String(child.id)) || filters.category.includes(id)}
                      disabled={filters.category.includes(id)}
                      onChange={(on) => onChange({ category: toggle(filters.category, String(child.id), on) })}
                    >
                      {child.name}
                    </Checkbox>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </Section>

      <Section title="Type">
        {TYPE_OPTIONS.map((option) => (
          <Checkbox
            key={option.value}
            checked={typeChecked(option.value)}
            // Au moins un type reste coché.
            disabled={typeChecked(option.value) && filters.type.length === 1}
            onChange={(on) => changeType(option.value, on)}
          >
            {option.label}
          </Checkbox>
        ))}
      </Section>

      <Section title="Région">
        {visibleRegions.map((region) => (
          <Checkbox
            key={region.id}
            checked={selectedRegions.has(String(region.id))}
            onChange={(on) => onChange({ region: toggle(filters.region, String(region.id), on) })}
          >
            {region.name}
          </Checkbox>
        ))}
        {sortedRegions.length > VISIBLE_REGIONS && (
          <button
            type="button"
            className="text-sm font-medium text-brand-600 hover:underline"
            onClick={() => setShowAllRegions((value) => !value)}
          >
            {showAllRegions ? 'Voir moins' : `Voir plus (${sortedRegions.length - visibleRegions.length})`}
          </button>
        )}
      </Section>

      <div className="space-y-4">
        <PriceField
          id={`${idPrefix}-price-min`}
          label="Prix minimum (TND)"
          value={filters.price_min}
          onCommit={(value) => onChange({ price_min: value })}
        />
        <PriceField
          id={`${idPrefix}-price-max`}
          label="Prix maximum (TND)"
          value={filters.price_max}
          onCommit={(value) => onChange({ price_max: value })}
        />
      </div>

      <Section title="Délai de disponibilité">
        <Radio name={`${idPrefix}-delay`} checked={!filters.delay} onChange={() => onChange({ delay: '' })}>
          Tous les délais
        </Radio>
        {DELAY_OPTIONS.map((option) => (
          <Radio
            key={option.value}
            name={`${idPrefix}-delay`}
            checked={filters.delay === option.value}
            onChange={() => onChange({ delay: option.value })}
          >
            {option.label}
          </Radio>
        ))}
      </Section>

      <Section title="Note du fournisseur">
        <Radio name={`${idPrefix}-rating`} checked={!filters.rating} onChange={() => onChange({ rating: '' })}>
          Toutes les notes
        </Radio>
        {RATING_OPTIONS.map((option) => (
          <Radio
            key={option.value}
            name={`${idPrefix}-rating`}
            checked={filters.rating === option.value}
            onChange={() => onChange({ rating: option.value })}
          >
            {option.label}
          </Radio>
        ))}
      </Section>

      <button type="button" className="text-sm font-medium text-brand-600 hover:underline" onClick={onReset}>
        Réinitialiser les filtres
      </button>
    </div>
  )
}
