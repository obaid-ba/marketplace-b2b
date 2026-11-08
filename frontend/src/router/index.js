import { createBrowserRouter } from 'react-router'
import { createRoutes } from './routes'

export const router = createBrowserRouter(createRoutes())

// Remonte en haut de la page à chaque changement d'adresse.
router.subscribe((state) => {
  if (state.navigation.state === 'idle' && state.historyAction !== 'POP') window.scrollTo(0, 0)
})
