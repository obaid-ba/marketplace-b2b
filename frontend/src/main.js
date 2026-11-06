import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { onAuthError } from './api/http'
import { useAuthStore } from './stores/auth'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 401 : jeton expiré ou révoqué → retour à la connexion. 403 : page "accès refusé".
onAuthError((status) => {
  const auth = useAuthStore(pinia)
  const current = router.currentRoute.value

  if (status === 401 && current.name !== 'login') {
    auth.clear()
    router.push({ name: 'login', query: { redirect: current.fullPath } })
  } else if (status === 403 && auth.isAuthenticated) {
    router.push({ name: 'forbidden' })
  }
})

app.mount('#app')
