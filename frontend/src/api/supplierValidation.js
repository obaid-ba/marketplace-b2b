import { http } from './http'

/**
 * État du dossier du fournisseur connecté (SCRUM-27) :
 * { status, rejection_reason, steps: { account_created_at, email_verified_at, reviewed_at }, is_published, documents }
 */
export async function fetchValidationStatus() {
  const { data } = await http.get('/supplier/validation-status')
  return data
}
