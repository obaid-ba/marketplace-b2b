import { useCallback, useEffect, useRef, useState } from 'react'

const PREFIX = 'marketplace:draft:'
const MAX_AGE_MS = 7 * 24 * 3600 * 1000

function read(key) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const { savedAt, value } = JSON.parse(raw)
    return Date.now() - savedAt > MAX_AGE_MS ? null : value
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), value }))
  } catch {
    // Stockage indisponible (navigation privée, quota) : le formulaire fonctionne sans brouillon.
  }
}

function remove(key) {
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    // ignoré
  }
}

/**
 * Aucune perte de saisie (SCRUM-92) : le formulaire est recopié dans le navigateur à chaque modification et
 * restauré à la réouverture de la page (coupure réseau, rechargement, onglet fermé par erreur).
 * Seuls des champs texte passent ici, jamais de fichier ni de mot de passe.
 *
 * @param {string|null} key  identifiant du brouillon ; null désactive le brouillon
 * @param {object} form      valeurs actuelles
 * @param {(updater: (current: object) => object) => void} setForm
 * @param {{ ready?: boolean }} options  ready : restaurer seulement une fois les données de la page chargées
 * @returns {{ restored: boolean, clear: () => void }}
 */
export function useFormDraft(key, form, setForm, { ready = true } = {}) {
  const [restored, setRestored] = useState(false)
  const checked = useRef(false)

  useEffect(() => {
    if (!key || !ready || checked.current) return
    checked.current = true
    const draft = read(key)
    if (draft && typeof draft === 'object') {
      setForm((current) => ({ ...current, ...draft }))
      setRestored(true)
    }
  }, [key, ready, setForm])

  useEffect(() => {
    if (!key || !checked.current) return
    write(key, form)
  }, [key, form])

  const clear = useCallback(() => {
    if (key) remove(key)
    setRestored(false)
  }, [key])

  return { restored, clear }
}
