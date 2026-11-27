import { useEffect, useId } from 'react'

/**
 * Fenêtre modale simple (confirmation, motif de retrait…). Fermeture : Échap, clic sur le fond, bouton.
 */
export default function Modal({ title, children, actions, onClose }) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-xl bg-surface p-6 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
        {actions && <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>}
      </div>
    </div>
  )
}
