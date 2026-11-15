/** Message d'erreur de validation affiché sous un champ (première erreur renvoyée par l'API). */
export function FieldError({ id, messages }) {
  if (!messages?.length) return null
  return (
    <p id={id} className="mt-1 text-sm text-danger">
      {messages[0]}
    </p>
  )
}

/** Libellé + champ + erreur. Le champ reçoit son id et aria-describedby. */
export function Field({ id, label, errors, className = '', children }) {
  const errorId = `${id}-error`
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, 'aria-invalid': errors?.length ? true : undefined, 'aria-describedby': errors?.length ? errorId : undefined })}
      <FieldError id={errorId} messages={errors} />
    </div>
  )
}

/** Style des champs de la maquette (bordure neutre/border, texte muted). */
export const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-brand-600 focus:ring-2 focus:ring-brand-100 aria-[invalid=true]:border-danger'
