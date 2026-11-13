import { http } from './http'

/**
 * Désactivation et suppression du compte (SCRUM-30).
 * Les deux actions demandent le mot de passe actuel : confirmation côté API.
 */
export async function deactivateAccount(password) {
  const { data } = await http.post('/account/deactivate', { password })
  return data
}

export async function deleteAccount(password) {
  const { data } = await http.delete('/account', { data: { password } })
  return data
}
