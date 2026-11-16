import { create } from 'zustand'
import { fetchAdminDashboard } from '@/api/adminDashboard'

/**
 * État du tableau de bord administrateur.
 *
 * `requestId` protège contre les réponses arrivées dans le désordre : quand
 * l'administrateur change de période pendant un chargement, seule la dernière
 * réponse est conservée.
 */
export const useAdminDashboardStore = create((set, get) => ({
  data: null,
  loading: false,
  error: null,
  requestId: 0,

  async load(range = {}) {
    const requestId = get().requestId + 1
    set({ loading: true, error: null, requestId })

    try {
      const data = await fetchAdminDashboard(range)
      if (get().requestId === requestId) {
        set({ data, loading: false })
      }
    } catch (error) {
      if (get().requestId === requestId) {
        set({
          error: error.userMessage ?? 'Impossible de charger le tableau de bord. Réessayez.',
          loading: false,
        })
      }
    }
  },

  reset() {
    set({ data: null, loading: false, error: null, requestId: 0 })
  },
}))

export const selectAdminDashboard = (state) => state.data
export const selectAdminDashboardLoading = (state) => state.loading
export const selectAdminDashboardError = (state) => state.error
