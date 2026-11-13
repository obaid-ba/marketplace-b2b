import { http } from './http'

/**
 * Profil de l'entreprise du fournisseur connecté (SCRUM-28).
 * L'API agit toujours sur le profil de l'utilisateur connecté (aucun identifiant dans l'URL).
 */

export async function fetchSupplierProfile() {
  const { data } = await http.get('/supplier/profile')
  return data
}

/** Champs texte + catégories proposées + zones couvertes. Renvoie { message, profile }. */
export async function updateSupplierProfile(payload) {
  const { data } = await http.put('/supplier/profile', payload)
  return data
}

export async function uploadSupplierLogo(file) {
  const body = new FormData()
  body.append('logo', file)
  const { data } = await http.post('/supplier/profile/logo', body)
  return data
}

/** Renvoie { message, profile } ; 422 si le compte n'est pas encore validé. */
export async function setSupplierProfilePublished(isPublished) {
  const { data } = await http.patch('/supplier/profile/publish', { is_published: isPublished })
  return data
}

/** Nouveau justificatif, toujours « en attente » de validation. Renvoie { message, document }. */
export async function addSupplierDocument(type, file) {
  const body = new FormData()
  body.append('type', type)
  body.append('file', file)
  const { data } = await http.post('/supplier/documents', body)
  return data
}

/**
 * Ouvre un justificatif (fichier privé) dans un nouvel onglet : le jeton Bearer ne peut pas
 * accompagner un simple lien, le fichier est donc téléchargé puis affiché.
 */
export async function openSupplierDocument(document) {
  // Onglet ouvert tout de suite (dans le clic) pour ne pas être bloqué par le navigateur.
  const tab = window.open('', '_blank')
  try {
    const { data } = await http.get(`/supplier/documents/${document.id}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    if (tab) {
      tab.location.href = url
    } else {
      window.location.assign(url)
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    tab?.close()
    throw error
  }
}

/** Listes de référence du formulaire. */
export async function fetchProfileReferences() {
  const [regions, categories, sectors] = await Promise.all([
    http.get('/reference/regions'),
    http.get('/reference/categories'),
    http.get('/reference/sectors'),
  ])
  return { regions: regions.data, categories: categories.data, sectors: sectors.data }
}
