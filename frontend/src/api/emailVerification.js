import { http } from './http'

/**
 * Vérification de l'adresse e-mail (SCRUM-24).
 *
 * Le lien reçu par e-mail ouvre /email/verifier?id=…&hash=…&expires=…&signature=…
 * La page transmet ces paramètres tels quels à l'API, qui contrôle la signature.
 *
 * @returns {Promise<{ status: 'verified', user: object } | { status: 'expired' | 'invalid' | 'already_verified' | 'error', message: string }>}
 */
export async function verifyEmail(searchParams) {
  const id = searchParams.get('id')
  const hash = searchParams.get('hash')
  const expires = searchParams.get('expires')
  const signature = searchParams.get('signature')

  if (!id || !hash || !expires || !signature) {
    return { status: 'invalid', message: "Ce lien de vérification n'est pas complet." }
  }

  try {
    const { data } = await http.get(`/auth/email/verify/${encodeURIComponent(id)}/${encodeURIComponent(hash)}`, {
      params: { expires, signature },
      skipAuthRedirect: true, // les erreurs (lien expiré, invalide…) sont affichées sur la page
    })
    return { status: 'verified', user: data.user }
  } catch (error) {
    const reason = error.response?.data?.reason
    const known = ['expired', 'invalid', 'already_verified']
    return { status: known.includes(reason) ? reason : 'error', message: error.userMessage }
  }
}

/** « Renvoyer le lien » (limité côté API à une fois par minute). */
export async function resendVerificationEmail() {
  const { data } = await http.post('/auth/email/resend', null, { skipAuthRedirect: true })
  return data.message
}
