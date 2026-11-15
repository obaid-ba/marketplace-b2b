/** Initiales affichées à la place d'un logo ou d'un avatar : « Atlas Emballages » → « AE ». */
export function initialsOf(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}
