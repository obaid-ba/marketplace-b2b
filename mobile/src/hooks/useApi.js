import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'

/**
 * Charge une ressource de l'API : { data, loading, refreshing, error, reload, refresh }.
 *
 * Synchronisation avec le site : les données sont rechargées sans indicateur à chaque retour sur l'écran
 * (une action faite sur le site ou sur un autre écran apparaît donc tout de suite), et toutes les
 * `pollMs` millisecondes si l'option est donnée.
 */
export default function useApi(fetcher, deps = [], { pollMs } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const loaded = useRef(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps)

  const load = useCallback(
    async (mode = 'load') => {
      if (mode === 'load') setLoading(true)
      if (mode === 'refresh') setRefreshing(true)
      if (mode !== 'silent') setError(null)
      try {
        setData(await run())
        loaded.current = true
        setError(null)
      } catch (requestError) {
        if (mode !== 'silent') setError(requestError.message || 'Une erreur est survenue.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [run],
  )

  useEffect(() => {
    load()
  }, [load])

  // Retour sur l'écran : mise à jour discrète.
  useFocusEffect(
    useCallback(() => {
      if (loaded.current) load('silent')
    }, [load]),
  )

  useEffect(() => {
    if (!pollMs) return undefined
    const timer = setInterval(() => load('silent'), pollMs)
    return () => clearInterval(timer)
  }, [load, pollMs])

  return { data, setData, loading, refreshing, error, reload: () => load(), refresh: () => load('refresh') }
}
