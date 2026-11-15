import { Field, inputClass } from './Field'

/** Champs texte du profil : nom, description, secteur, gouvernorat, téléphone, e-mail. */
export default function CompanyInfoForm({ form, errors, sectors, regions, onChange }) {
  const update = (field) => (event) => onChange(field, event.target.value)

  // Un secteur saisi avant la liste fixe (inscription) reste affiché et conservé.
  const sectorOptions = form.sector && !sectors.includes(form.sector) ? [form.sector, ...sectors] : sectors

  return (
    <div className="space-y-5">
      <Field id="company_name" label="Nom de l’entreprise" errors={errors.company_name}>
        {(props) => (
          <input {...props} type="text" className={inputClass} maxLength={255} value={form.company_name} onChange={update('company_name')} />
        )}
      </Field>

      <Field id="description" label="Description" errors={errors.description}>
        {(props) => (
          <textarea
            {...props}
            rows={4}
            maxLength={2000}
            className={`${inputClass} resize-y`}
            value={form.description}
            onChange={update('description')}
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="sector" label="Secteur" errors={errors.sector}>
          {(props) => (
            <select {...props} className={inputClass} value={form.sector} onChange={update('sector')}>
              <option value="">Choisir un secteur</option>
              {sectorOptions.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field id="region_id" label="Gouvernorat" errors={errors.region_id}>
          {(props) => (
            <select {...props} className={inputClass} value={form.region_id} onChange={update('region_id')}>
              <option value="">Choisir un gouvernorat</option>
              {regions.map((region) => (
                <option key={region.id} value={String(region.id)}>
                  {region.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field id="professional_phone" label="Téléphone" errors={errors.professional_phone}>
          {(props) => (
            <input
              {...props}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+216 74 000 000"
              className={inputClass}
              value={form.professional_phone}
              onChange={update('professional_phone')}
            />
          )}
        </Field>

        <Field id="professional_email" label="Adresse e-mail" errors={errors.professional_email}>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete="email"
              placeholder="contact@entreprise.tn"
              className={inputClass}
              value={form.professional_email}
              onChange={update('professional_email')}
            />
          )}
        </Field>
      </div>
    </div>
  )
}
