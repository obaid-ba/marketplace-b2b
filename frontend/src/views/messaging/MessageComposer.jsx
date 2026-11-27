import { useRef, useState } from 'react'
import { ATTACHMENT_ACCEPT, attachmentError, formatFileSize } from './messageUtils'

/** Saisie d'un message avec pièce jointe. Entrée envoie, Maj + Entrée va à la ligne. */
export default function MessageComposer({ onSend, initialText = '' }) {
  const [text, setText] = useState(initialText)
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const fileInput = useRef(null)
  const textarea = useRef(null)

  const canSend = !sending && (text.trim() !== '' || file !== null)

  function chooseFile(event) {
    const chosen = event.target.files?.[0]
    event.target.value = '' // permet de rechoisir le même fichier
    if (!chosen) return
    const problem = attachmentError(chosen)
    setError(problem)
    setFile(problem ? null : chosen)
  }

  async function submit(event) {
    event?.preventDefault()
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      await onSend({ body: text.trim(), attachment: file })
      setText('')
      setFile(null)
    } catch (err) {
      // Le texte et le fichier restent en place pour réessayer.
      const first = Object.values(err.fieldErrors ?? {})[0]?.[0]
      setError(first ?? err.userMessage ?? "Le message n'a pas pu être envoyé.")
    } finally {
      setSending(false)
      textarea.current?.focus()
    }
  }

  function onKeyDown(event) {
    // isComposing : ne pas envoyer pendant la saisie d'un caractère composé (accents, arabe…).
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event)
  }

  return (
    <form onSubmit={submit} className="border-t border-line bg-surface p-3">
      {error && (
        <p role="alert" className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {file && (
        <p className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-page px-3 py-2 text-sm text-ink">
          <span className="truncate">
            📎 {file.name} <span className="text-muted">({formatFileSize(file.size)})</span>
          </span>
          <button type="button" className="shrink-0 text-danger hover:underline" onClick={() => setFile(null)} disabled={sending}>
            Retirer
          </button>
        </p>
      )}
      <div className="flex items-end gap-2">
        <input ref={fileInput} type="file" className="hidden" accept={ATTACHMENT_ACCEPT} onChange={chooseFile} aria-label="Pièce jointe" />
        <button
          type="button"
          className="btn-ghost h-10 px-3"
          onClick={() => fileInput.current?.click()}
          disabled={sending}
          aria-label="Joindre un fichier"
          title="Joindre un fichier (10 Mo maximum)"
        >
          📎
        </button>
        <textarea
          ref={textarea}
          rows={1}
          maxLength={5000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Écrivez votre message…"
          aria-label="Votre message"
          className="input field-sizing-content max-h-40 min-h-10 flex-1 resize-none"
        />
        <button type="submit" className="btn-primary h-10" disabled={!canSend}>
          {sending ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
    </form>
  )
}
