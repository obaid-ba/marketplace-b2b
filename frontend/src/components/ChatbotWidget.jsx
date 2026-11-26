import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { sendChatbotMessage } from '@/api/chatbot'
import { APP_NAME } from '@/config/brand'
import { loginPath } from '@/router/paths'
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth'

const WELCOME = `Bonjour ! Je suis l’assistant de ${APP_NAME}. Posez-moi une question sur l’utilisation de la plateforme : publier un besoin, répondre à une demande, commander, suivre une commande, laisser un avis…`

const SUGGESTIONS = ['Comment publier une demande ?', 'Comment répondre à une demande ?', 'Comment suivre ma commande ?']

/** Identifiant de conversation (une par ouverture de session du navigateur). */
function newConversationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

/**
 * Chatbot d'assistance (SCRUM-85) : bouton flottant sur toutes les pages, panneau flottant sur ordinateur,
 * plein écran sur mobile. Les réponses viennent du guide de la plateforme ; aucune donnée d'un autre
 * utilisateur n'est accessible. Un visiteur est invité à se connecter.
 */
export default function ChatbotWidget() {
  const location = useLocation()
  const authenticated = useAuthStore(selectIsAuthenticated)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ from: 'assistant', text: WELCOME, links: [] }])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const conversationId = useRef(newConversationId())
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight })
  }, [messages, open])

  useEffect(() => {
    if (!open) return undefined
    inputRef.current?.focus()
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  async function send(text) {
    const message = text.trim()
    if (message.length < 2 || sending) return

    const history = messages.slice(-6).map(({ from, text: content }) => ({ from, text: content }))
    setMessages((current) => [...current, { from: 'user', text: message }])
    setDraft('')
    setSending(true)
    try {
      const data = await sendChatbotMessage({ conversationId: conversationId.current, message, history, page: location.pathname })
      setMessages((current) => [...current, { from: 'assistant', text: data.answer, links: data.links ?? [] }])
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          from: 'assistant',
          error: true,
          text: err.response?.data?.message ?? err.userMessage ?? 'Je ne peux pas répondre pour le moment. Réessayez dans un instant.',
        },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:outline-none"
          aria-label="Ouvrir l’assistant"
        >
          <span aria-hidden="true">✦</span> Besoin d’aide ?
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label={`Assistant ${APP_NAME}`}
          className="fixed inset-0 z-50 flex flex-col bg-surface sm:inset-auto sm:right-4 sm:bottom-4 sm:h-[32rem] sm:w-96 sm:rounded-2xl sm:border sm:border-line sm:shadow-2xl"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="font-semibold text-ink">Assistant</p>
              <p className="text-xs text-muted">Réponses tirées du guide de la plateforme</p>
            </div>
            <button type="button" className="btn-ghost px-2" onClick={() => setOpen(false)} aria-label="Fermer l’assistant">
              ✕
            </button>
          </header>

          <ol ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((item, index) => (
              <li key={index} className={`flex ${item.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line ${
                    item.from === 'user'
                      ? 'bg-brand-600 text-white'
                      : item.error
                        ? 'bg-danger-soft text-danger'
                        : 'bg-page text-ink'
                  }`}
                >
                  {item.text}
                  {item.links?.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {item.links.map((link) => (
                        <li key={link.path}>
                          <Link
                            to={link.path}
                            onClick={() => window.matchMedia?.('(max-width: 639px)').matches && setOpen(false)}
                            className="inline-block rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-brand-600 ring-1 ring-brand-100 hover:bg-brand-50"
                          >
                            {link.label} →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
            {sending && (
              <li className="text-xs text-muted" aria-label="L’assistant écrit">
                L’assistant écrit…
              </li>
            )}
          </ol>

          {authenticated ? (
            <div className="border-t border-line p-3">
              {messages.length === 1 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-full bg-page px-2.5 py-1 text-xs text-ink hover:bg-brand-50"
                      onClick={() => send(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  send(draft)
                }}
              >
                <label htmlFor="chatbot-input" className="sr-only">
                  Votre question
                </label>
                <input
                  id="chatbot-input"
                  ref={inputRef}
                  className="input flex-1"
                  value={draft}
                  maxLength={1000}
                  placeholder="Votre question…"
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button type="submit" className="btn-primary" disabled={sending || draft.trim().length < 2}>
                  Envoyer
                </button>
              </form>
            </div>
          ) : (
            <div className="border-t border-line p-4 text-sm text-muted">
              Connectez-vous pour poser vos questions à l’assistant.{' '}
              <Link to={loginPath(location.pathname + location.search)} className="font-medium text-brand-600 hover:underline">
                Se connecter
              </Link>
            </div>
          )}
        </section>
      )}
    </>
  )
}
