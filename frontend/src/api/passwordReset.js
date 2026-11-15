import { http } from './http'

/** « Mot de passe oublié » (SCRUM-26) : la réponse est la même que le compte existe ou non. */
export async function requestPasswordReset(email) {
  const { data } = await http.post('/auth/forgot-password', { email })
  return data.message
}

/** Enregistre le nouveau mot de passe à partir du lien reçu par e-mail (token + email). */
export async function resetPassword({ token, email, password, passwordConfirmation }) {
  const { data } = await http.post(
    '/auth/reset-password',
    { token, email, password, password_confirmation: passwordConfirmation },
    { skipAuthRedirect: true },
  )
  return data.message
}
