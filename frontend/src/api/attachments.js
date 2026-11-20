import { http } from './http'

/**
 * Télécharge une pièce jointe privée d'une demande : le jeton Bearer ne peut pas
 * accompagner un simple lien, le fichier est donc récupéré puis enregistré sous
 * son nom d'origine.
 */
export async function downloadTenderAttachment(tenderId, attachment, scope = 'buyer') {
  const { data } = await http.get(`/${scope}/tenders/${tenderId}/attachments/${attachment.id}`, {
    responseType: 'blob',
  })

  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.name ?? 'piece-jointe'
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
