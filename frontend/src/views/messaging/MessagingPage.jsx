import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { fetchConversations } from '@/api/messaging'
import PageHeader from '@/components/PageHeader'
import { isRealtimeConnected, useRealtime } from '@/realtime/realtime'
import { conversationPath, messagingPathFor } from '@/router/paths'
import { selectRole, useAuthStore } from '@/stores/auth'
import ConversationList from './ConversationList'
import ConversationThread from './ConversationThread'

const POLL_INTERVAL = 15_000 // seulement quand le temps réel n'est pas connecté
const SEARCH_DELAY = 300

/**
 * Messagerie (SCRUM-59 à SCRUM-61) : conversations à gauche, fil à droite ;
 * sur mobile, l'un ou l'autre selon l'adresse.
 */
export default function MessagingPage() {
  const role = useAuthStore(selectRole)
  const { conversationId } = useParams()
  const location = useLocation()
  const activeId = conversationId ? Number(conversationId) : null

  const [conversations, setConversations] = useState(null)
  const [meta, setMeta] = useState(null)
  const [pages, setPages] = useState(1)
  const [error, setError] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const latestRequest = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), SEARCH_DELAY)
    return () => clearTimeout(timer)
  }, [searchText])

  const load = useCallback(async () => {
    // Seule la dernière demande compte : une réponse lente ne remplace pas une plus récente.
    const request = ++latestRequest.current
    try {
      const result = await fetchConversations({
        search: search || undefined,
        unread: unreadOnly ? 1 : undefined,
        per_page: Math.min(50, 20 * pages),
      })
      if (request !== latestRequest.current) return
      setConversations(result.data)
      setMeta(result.meta)
      setError(null)
    } catch (err) {
      if (request === latestRequest.current) setError(err.userMessage ?? 'Impossible de charger vos conversations.')
    }
  }, [pages, search, unreadOnly])

  useEffect(() => {
    load()
  }, [load])

  useRealtime('message.sent', load)
  useRealtime('conversation.read', load)
  useRealtime('connected', load)

  useEffect(() => {
    const timer = setInterval(() => !isRealtimeConnected() && load(), POLL_INTERVAL)
    window.addEventListener('focus', load)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [load])

  const filtered = search !== '' || unreadOnly
  const canShowMore = meta && meta.total > (conversations?.length ?? 0) && pages < 3

  return (
    <>
      <PageHeader title="Messagerie" subtitle="Vos échanges sur les demandes, les devis et les commandes." />

      <div className="flex h-[calc(100dvh-14rem)] min-h-[28rem] overflow-hidden rounded-xl border border-line bg-surface">
        <section
          aria-label="Conversations"
          className={`${activeId ? 'hidden lg:flex' : 'flex'} w-full flex-col border-line lg:w-80 lg:shrink-0 lg:border-r`}
        >
          <div className="space-y-2 border-b border-line p-3">
            <input
              type="search"
              className="input"
              placeholder="Contact ou message…"
              aria-label="Rechercher une conversation"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="accent-brand-600" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />
              Non lues seulement
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {error && (
              <div role="alert" className="m-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}{' '}
                <button type="button" className="font-medium underline" onClick={load}>
                  Réessayer
                </button>
              </div>
            )}
            {!conversations && !error && <p className="p-6 text-center text-sm text-muted">Chargement…</p>}
            {conversations?.length === 0 && (
              <p className="p-6 text-center text-sm text-muted">
                {filtered
                  ? 'Aucune conversation ne correspond.'
                  : role === 'buyer'
                    ? 'Aucune conversation. Contactez un fournisseur depuis sa fiche, un devis ou une commande.'
                    : 'Aucune conversation. Répondez à une demande ou écrivez depuis une commande.'}
              </p>
            )}
            {conversations?.length > 0 && (
              <ConversationList conversations={conversations} activeId={activeId} pathFor={(id) => conversationPath(role, id)} />
            )}
            {canShowMore && (
              <div className="p-3 text-center">
                <button type="button" className="btn-secondary" onClick={() => setPages((value) => value + 1)}>
                  Afficher plus
                </button>
              </div>
            )}
          </div>
        </section>

        <section aria-label="Conversation" className={`${activeId ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col`}>
          {activeId ? (
            <ConversationThread
              key={activeId}
              conversationId={activeId}
              draft={location.state?.draft}
              backPath={messagingPathFor(role)}
              onActivity={load}
            />
          ) : (
            <p className="m-auto p-6 text-center text-sm text-muted">Choisissez une conversation pour l'afficher.</p>
          )}
        </section>
      </div>
    </>
  )
}
