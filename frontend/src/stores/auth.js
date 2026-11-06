import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { http } from '@/api/http'
import { tokenStorage } from '@/utils/tokenStorage'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(tokenStorage.get())
  const loaded = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value && user.value))
  const role = computed(() => user.value?.role ?? null)

  /** Charge l'utilisateur à partir du jeton enregistré (appelé une fois au démarrage). */
  async function fetchMe() {
    if (!token.value) {
      loaded.value = true
      return
    }
    try {
      const { data } = await http.get('/auth/me')
      user.value = data
    } catch {
      clear()
    } finally {
      loaded.value = true
    }
  }

  async function login(email, password) {
    const { data } = await http.post('/auth/login', { email, password, device_name: 'web' })
    token.value = data.token
    tokenStorage.set(data.token)
    user.value = data.user
    loaded.value = true
    return data.user
  }

  async function logout() {
    try {
      await http.post('/auth/logout')
    } finally {
      clear()
    }
  }

  function clear() {
    user.value = null
    token.value = null
    tokenStorage.clear()
  }

  return { user, token, loaded, isAuthenticated, role, fetchMe, login, logout, clear }
})
