import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

const POLL_MS = 30000

const UnreadContext = createContext({ messages: 0, notifications: 0, refresh: () => {} })

/**
 * Compteurs partagés avec le site (messages et notifications non lus) : relus toutes les 30 secondes,
 * au retour au premier plan de l'application, et après chaque lecture.
 */
export function UnreadProvider({ children }) {
  const { user } = useAuth()
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 })

  const refresh = useCallback(async () => {
    if (!user) return
    const [messages, notifications] = await Promise.all([
      user.role === 'admin' ? Promise.resolve(null) : api('/conversations/unread-count').catch(() => null),
      api('/notifications/unread-count').catch(() => null),
    ])
    setCounts({ messages: messages?.count ?? 0, notifications: notifications?.count ?? notifications?.unread ?? 0 })
  }, [user])

  useEffect(() => {
    if (!user) {
      setCounts({ messages: 0, notifications: 0 })
      return undefined
    }
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refresh())
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [user, refresh])

  return <UnreadContext.Provider value={{ ...counts, refresh }}>{children}</UnreadContext.Provider>
}

export const useUnread = () => useContext(UnreadContext)
