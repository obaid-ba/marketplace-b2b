/**
 * Règles de robustesse du mot de passe, identiques à l'API
 * (Password::min(8)->letters()->mixedCase()->numbers(), voir AppServiceProvider).
 */
export const PASSWORD_RULES = [
  { id: 'length', label: '8 caractères minimum', test: (v) => v.length >= 8 },
  { id: 'upper', label: 'Une majuscule', test: (v) => /\p{Lu}/u.test(v) },
  { id: 'lower', label: 'Une minuscule', test: (v) => /\p{Ll}/u.test(v) },
  { id: 'digit', label: 'Un chiffre', test: (v) => /\d/.test(v) },
]

export function isStrongPassword(value) {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}
