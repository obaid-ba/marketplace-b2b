import { http } from './http'

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
