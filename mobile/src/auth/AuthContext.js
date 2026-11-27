import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api, setToken, setUnauthorizedHandler } from '../api/client'

const KEY = 'tijaralink_session'

// Le jeton est rangé dans le trousseau du téléphone ; le navigateur n'en a pas, il utilise le stockage local.
const storage = {
  get: () => (Platform.OS === 'web' ? AsyncStorage.getItem(KEY) : SecureStore.getItemAsync(KEY)),
  set: (value) => (Platform.OS === 'web' ? AsyncStorage.setItem(KEY, value) : SecureStore.setItemAsync(KEY, value)),
  clear: () => (Platform.OS === 'web' ? AsyncStorage.removeItem(KEY) : SecureStore.deleteItemAsync(KEY)),
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const forget = useCallback(async () => {
    setToken(null)
    setUser(null)
    await storage.clear().catch(() => {})
  }, [])

  // Au démarrage : session enregistrée, vérifiée auprès de l'API.
  useEffect(() => {
    setUnauthorizedHandler(() => forget())
    ;(async () => {
      try {
        const saved = await storage.get()
        if (saved) {
          const { token } = JSON.parse(saved)
          setToken(token)
          const account = await api('/account')
          setUser(account.user ?? account)
        }
      } catch {
        await forget()
      } finally {
        setReady(true)
      }
    })()
  }, [forget])

  const login = useCallback(async (email, password, remember) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password, remember } })
    setToken(data.token)
    await storage.set(JSON.stringify({ token: data.token }))
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    await forget()
  }, [forget])

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
