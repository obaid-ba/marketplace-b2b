import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  downloadMessageAttachment,
  fetchConversation,
  fetchMessages,
  markConversationRead,
  sendMessage,
} from '@/api/messaging'
import { isRealtimeConnected, useRealtime } from '@/realtime/realtime'
import { selectUser, useAuthStore } from '@/stores/auth'
import { useMessagingStore } from '@/stores/messaging'
import MessageComposer from './MessageComposer'
import { dayLabel, formatFileSize, mergeMessages, timeLabel } from './messageUtils'

const POLL_INTERVAL = 10_000 // seulement quand le temps réel n'est pas connecté

function Bubble({ message, seen, onDownload }) {
  return (
    <li className={`flex flex-col ${message.is_mine ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2 sm:max-w-[70%] ${message.is_mine ? 'bg-brand-600 text-white' : 'bg-page text-ink'}`}>
        {message.body && <p className="text-sm break-words whitespace-pre-wrap">{message.body}</p>}
        {message.attachment && (
          <button
            type="button"
            onClick={() => onDownload(message)}
            className={`mt-1 flex max-w-full items-center gap-2 text-left text-sm underline ${message.is_mine ? 'text-white' : 'text-brand-600'}`}
          >
            <span aria-hidden="true">📎</span>
            <span className="truncate">{message.attachment.name}</span>
            <span className="shrink-0 text-xs no-underline opacity-80">{formatFileSize(message.attachment.size)}</span>
          </button>
        )}
      </div>
      <span className="mt-1 px-1 text-[11px] text-muted">
        {timeLabel(message.sent_at)}
        {seen && ' · Lu'}
      </span>
    </li>
  )
}

/**
 * Fil d'une conversation (SCRUM-60). À monter avec key={conversationId} : changer de conversation repart de zéro.
 * onActivity : prévient la liste (nouveau message, lecture).
 */
export default function ConversationThread({ conversationId, draft, backPath, onActivity }) {
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [status, setStatus] = useState('loading') // loading | ready | not-found | error
  const [error, setError] = useState(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [otherReadId, setOtherReadId] = useState(0)
  const myId = useAuthStore(selectUser)?.id
  const setUnread = useMessagingStore((state) => state.setUnread)

  const scroller = useRef(null)
  const stickToBottom = useRef(true)
  const previousHeight = useRef(null)
  const lastId = useRef(0)
  const mounted = useRef(true)
  const ready = useRef(false)
  const missed = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const addMessages = useCallback((incoming) => {
    if (!incoming.length) return
    lastId.current = Math.max(lastId.current, ...incoming.map((message) => message.id))
    setMessages((current) => mergeMessages(current, incoming))
  }, [])

  const markRead = useCallback(async () => {
    // Onglet en arrière-plan : le message n'a pas été vu.
    if (document.visibilityState === 'hidden') return
    try {
      setUnread(await markConversationRead(conversationId))
      onActivity?.()
    } catch {
      // Réessayé au prochain message ou au retour sur l'onglet.
    }
  }, [conversationId, onActivity, setUnread])

  const fetchNew = useCallback(async () => {
    if (!ready.current) {
      missed.current = true // l'historique se charge encore : on rattrape juste après
      return
    }
    try {
      const { data } = await fetchMessages(conversationId, { after: lastId.current || undefined })
      if (!mounted.current || !data.length) return
      addMessages(data)
      if (data.some((message) => !message.is_mine)) await markRead()
      else onActivity?.()
    } catch {
      // Prochain événement ou prochain rafraîchissement.
    }
  }, [addMessages, conversationId, markRead, onActivity])

  const load = useCallback(async () => {
    setStatus('loading')
    ready.current = false
    try {
      const [detail, page] = await Promise.all([fetchConversation(conversationId), fetchMessages(conversationId)])
      if (!mounted.current) return
      setConversation(detail)
      setOtherReadId(detail.other_last_read_message_id ?? 0)
      setHasMore(page.has_more)
      addMessages(page.data)
      ready.current = true
      setStatus('ready')
      if (missed.current) {
        missed.current = false
        fetchNew()
      }
      if (detail.unread_count > 0) markRead()
    } catch (err) {
      if (!mounted.current) return
      if (err.response?.status === 404) setStatus('not-found')
      else {
        setError(err.userMessage ?? 'Impossible de charger la conversation.')
        setStatus('error')
      }
    }
  }, [addMessages, conversationId, fetchNew, markRead])

  useEffect(() => {
    load()
    // Une seule fois : le composant est remonté à chaque conversation (key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useRealtime('message.sent', (event) => event.conversation_id === conversationId && fetchNew())
  useRealtime('connected', fetchNew)
  useRealtime('conversation.read', (event) => {
    // Ma propre lecture (autre onglet) ne compte pas comme accusé de l'autre personne.
    if (event.conversation_id === conversationId && event.reader_id !== myId) {
      setOtherReadId((current) => Math.max(current, event.last_read_message_id))
    }
  })

  useEffect(() => {
    const timer = setInterval(() => !isRealtimeConnected() && fetchNew(), POLL_INTERVAL)
    const onVisible = () => {
      if (document.visibilityState === 'hidden') return
      fetchNew()
      if (ready.current) markRead()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchNew, markRead])

  // Reste en bas pour un nouveau message ; garde la position quand on charge l'historique ou qu'on relit plus haut.
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    if (previousHeight.current !== null) {
      element.scrollTop += element.scrollHeight - previousHeight.current
      previousHeight.current = null
    } else if (stickToBottom.current) {
      element.scrollTop = element.scrollHeight
    }
  }, [messages, status])

  function onScroll() {
    const element = scroller.current
    stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80
  }

  async function loadOlder() {
    setLoadingOlder(true)
    try {
      const page = await fetchMessages(conversationId, { before: messages[0].id })
      if (!mounted.current) return
      previousHeight.current = scroller.current?.scrollHeight ?? null
      setHasMore(page.has_more)
      setMessages((current) => mergeMessages(current, page.data))
    } catch (err) {
      setError(err.userMessage ?? "L'historique n'a pas pu être chargé.")
    } finally {
      setLoadingOlder(false)
    }
  }

  async function handleSend(payload) {
    const message = await sendMessage(conversationId, payload)
    if (!mounted.current) return
    stickToBottom.current = true
    // Un message reçu pendant l'envoi a un identifiant plus petit : on relit depuis le dernier connu.
    const since = lastId.current
    addMessages([message])
    onActivity?.()
    if (since && message.id > since + 1) {
      fetchMessages(conversationId, { after: since })
        .then(({ data }) => mounted.current && addMessages(data))
        .catch(() => {})
    }
  }

  async function handleDownload(message) {
    setError(null)
    try {
      await downloadMessageAttachment(message)
    } catch {
      setError("La pièce jointe n'a pas pu être téléchargée.")
    }
  }

  if (status === 'loading') return <p className="m-auto text-sm text-muted">Chargement de la conversation…</p>
  if (status === 'not-found' || status === 'error') {
    return (
      <div className="m-auto p-6 text-center">
        <p className="font-semibold text-ink">{status === 'not-found' ? 'Conversation introuvable' : 'Conversation indisponible'}</p>
        {status === 'error' && <p className="mt-1 text-sm text-muted">{error}</p>}
        <div className="mt-4 flex justify-center gap-3">
          {status === 'error' && (
            <button type="button" className="btn-primary" onClick={load}>
              Réessayer
            </button>
          )}
          <Link to={backPath} className="btn-secondary">
            Toutes les conversations
          </Link>
        </div>
      </div>
    )
  }

  const lastMine = messages.findLast((message) => message.is_mine)

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link to={backPath} className="btn-ghost -ml-2 px-2 lg:hidden" aria-label="Toutes les conversations">
          ←
        </Link>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-ink">{conversation.party.name}</h2>
          <p className="truncate text-xs text-muted">
            {conversation.context.url ? (
              <Link to={conversation.context.url} className="text-brand-600 hover:underline">
                {conversation.context.label}
              </Link>
            ) : (
              conversation.context.label
            )}
            {conversation.party.contact && conversation.party.contact !== conversation.party.name && ` · ${conversation.party.contact}`}
          </p>
        </div>
      </header>

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {hasMore && (
          <div className="mb-4 text-center">
            <button type="button" className="btn-secondary" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Chargement…' : 'Messages précédents'}
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">Aucun message pour le moment. Écrivez le premier.</p>
        )}
        <ul aria-live="polite" aria-label="Messages" className="space-y-3">
          {messages.map((message, index) => {
            const day = dayLabel(message.sent_at)
            const newDay = index === 0 || dayLabel(messages[index - 1].sent_at) !== day
            return (
              <Fragment key={message.id}>
                {newDay && <li className="py-2 text-center text-xs text-muted">{day}</li>}
                <Bubble message={message} seen={message === lastMine && message.id <= otherReadId} onDownload={handleDownload} />
              </Fragment>
            )
          })}
        </ul>
      </div>

      {error && (
        <p role="alert" className="mx-3 mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <MessageComposer onSend={handleSend} initialText={draft} />
    </>
  )
}
