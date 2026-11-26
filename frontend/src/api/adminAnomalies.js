import { http } from './http'

/**
 * Alertes d'anomalie (SCRUM-86).
 * Liste : { data: [{ id, target_type, target_id, target_label, anomaly_type, score, status, created_at }], meta, counts: { new } }.
 */
export async function fetchAnomalies(params = {}) {
  const { data } = await http.get('/admin/anomalies', { params })
  return data
}

/** Lance la détection sans attendre la tâche planifiée. Réponse : { message, count }. */
export async function scanAnomalies() {
  const { data } = await http.post('/admin/anomalies/scan')
  return data
}

/** decision : 'handle' (traitée) ou 'ignore' (ignorée). Réponse : { message, alert }. */
export async function decideAnomaly(id, decision, note = null) {
  const { data } = await http.post(`/admin/anomalies/${id}/${decision}`, note ? { note } : {})
  return data
}
