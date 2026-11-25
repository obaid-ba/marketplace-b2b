import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from './router'
import { PATHS, loginPath } from './router/paths'
import { onAuthError } from './api/http'
import { selectIsAuthenticated, useAuthStore } from './stores/auth'
import { startRealtime } from './realtime/realtime'
import './style.css'

// 401 : jeton expiré ou révoqué → retour à la connexion.
// 403 : e-mail pas encore vérifié → « Consultez votre boîte mail » ;
//       fournisseur pas encore validé (page de vente) → « Compte en attente » (SCRUM-27) ;
//       sinon page "accès refusé".
onAuthError((status, error) => {
  const auth = useAuthStore.getState()
  const { pathname, search } = router.state.location
  const reason = error.response?.data?.reason

  if (status === 401 && pathname !== PATHS.login) {
    auth.clear()
    router.navigate(loginPath(pathname + search))
  } else if (status === 403 && reason === 'email_not_verified') {
    auth.fetchMe().then(() => router.navigate(PATHS.verifyNotice))
  } else if (status === 403 && reason === 'supplier_not_validated') {
    auth.fetchMe().then(() => router.navigate(PATHS.supplierPending))
  } else if (status === 403 && selectIsAuthenticated(auth)) {
    router.navigate(PATHS.forbidden)
  }
})

startRealtime()

// Application installable et page hors ligne (PWA, SCRUM-88) : uniquement en production, pour ne pas
// servir d'anciens fichiers pendant le développement.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sans service worker, l'application fonctionne normalement (simplement pas hors ligne).
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
