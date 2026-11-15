import { FieldError } from './Field'

/** Zones couvertes : une case à cocher par gouvernorat. Sert aussi à la diffusion des demandes. */
export default function CoverageZones({ regions, selectedIds, errors, onChange }) {
  function toggle(id) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((selected) => selected !== id) : [...selectedIds, id])
  }

  return (
    <fieldset>
      <legend className="mb-3 text-lg font-semibold text-ink">Zones couvertes</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {regions.map((region) => (
          <label key={region.id} className="inline-flex cursor-pointer items-center gap-2 text-[15px] text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line accent-brand-600"
              checked={selectedIds.includes(region.id)}
              onChange={() => toggle(region.id)}
            />
            {region.name}
          </label>
        ))}
      </div>
      <FieldError messages={errors} />
    </fieldset>
  )
}
