import { Link } from 'react-router'
import { initialsOf } from '@/utils/initials'
import { messagePreview, shortDate } from './messageUtils'

function Avatar({ party }) {
  return party.avatar_url ? (
    <img src={party.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
  ) : (
    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">
      {initialsOf(party.name)}
    </span>
  )
}

/** Liste des conversations (SCRUM-59) : dernier message, contexte, non lus. */
export default function ConversationList({ conversations, activeId, pathFor }) {
  return (
    <ul>
      {conversations.map((conversation) => {
        const active = conversation.id === activeId
        const unread = conversation.unread_count
        return (
          <li key={conversation.id}>
            <Link
              to={pathFor(conversation.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex gap-3 border-b border-line px-4 py-3 transition ${active ? 'bg-brand-50' : 'hover:bg-page'}`}
            >
              <Avatar party={conversation.party} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm ${unread ? 'font-semibold' : 'font-medium'} text-ink`}>{conversation.party.name}</span>
                  <span className="shrink-0 text-xs text-muted">{shortDate(conversation.last_message_at)}</span>
                </span>
                <span className="block truncate text-xs text-brand-600">{conversation.context.label}</span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${unread ? 'font-medium text-ink' : 'text-muted'}`}>
                    {messagePreview(conversation.last_message)}
                  </span>
                  {unread > 0 && (
                    <span
                      aria-label={`${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}`}
                      className="grid min-w-5 shrink-0 place-items-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white"
                    >
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
