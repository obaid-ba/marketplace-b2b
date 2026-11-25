import { useEffect, useState } from 'react'

/**
 * Bandeau « hors ligne » (SCRUM-88 / SCRUM-92) : prévient dès que la connexion tombe, disparaît à son retour.
 */
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (online) return null

  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[60] bg-ink px-4 py-2 text-center text-sm text-white">
      Vous êtes hors ligne. Vos saisies sont conservées ; elles pourront être envoyées dès le retour de la connexion.
    </div>
  )
}
