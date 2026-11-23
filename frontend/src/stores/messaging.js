import { create } from 'zustand'
import { fetchUnreadMessages } from '@/api/messaging'

/** Nombre de messages non lus, affiché dans le menu (SCRUM-59). */
export const useMessagingStore = create((set) => ({
  unread: 0,

  async refreshUnread() {
    try {
      set({ unread: await fetchUnreadMessages() })
    } catch {
      // Le compteur ne doit jamais gêner la navigation.
    }
  },

  setUnread(unread) {
    set({ unread })
  },
}))
