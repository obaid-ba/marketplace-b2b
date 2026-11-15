import { http } from './http'

/** Mise à jour complète du compte (SCRUM-98) : informations, profil et adresse e-mail. */
export async function updateAccount(payload) {
  const { data } = await http.put('/account', payload)
  return data
}

/** Modification des informations personnelles (SCRUM-27). */
export async function updateProfile(payload) {
  const { data } = await http.patch('/account/profile', payload)
  return data
}

/** Changement d'adresse e-mail : l'API renvoie le compte repassé « e-mail à vérifier ». */
export async function updateEmail(email) {
  const { data } = await http.patch('/account/email', { email })
  return data
}

/** Changement de mot de passe : l'ancien mot de passe est exigé par l'API. */
export async function updatePassword(payload) {
  const { data } = await http.put('/account/password', payload)
  return data
}

/** Désactivation du compte (SCRUM-30) : confirmation par mot de passe. */
export async function deactivateAccount(password) {
  const { data } = await http.post('/account/deactivate', { password })
  return data
}

/** Suppression douce du compte (SCRUM-30) : confirmation par mot de passe. */
export async function deleteAccount(password) {
  const { data } = await http.delete('/account', { data: { password } })
  return data
}
