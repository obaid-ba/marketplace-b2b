import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { openConversation } from '@/api/messaging'
import { conversationPath, loginPath } from '@/router/paths'
import { selectRole, useAuthStore } from '@/stores/auth'
import { ROLES } from '@/utils/roles'

/**
 * « Contacter » : ouvre la conversation liée à un contexte (SCRUM-61).
 * - contact direct : réservé aux porteurs ; un visiteur passe par la connexion puis revient sur la page ;
 * - demande, devis, commande : les deux parties ; l'API vérifie que l'utilisateur est concerné.
 *
 * draft : début de message proposé, par exemple le nom du produit consulté.
 */
export default function ContactButton({
  contextType = 'direct',
  contextId,
  supplierId,
  draft,
  label = 'Contacter',
  className = 'btn-secondary',
}) {
  const role = useAuthStore(selectRole)
  const navigate = useNavigate()
  const location = useLocation()
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState(null)

  const allowed = contextType === 'direct' ? [ROLES.BUYER] : [ROLES.BUYER, ROLES.SUPPLIER]
  if (role && !allowed.includes(role)) return null

  async function handleClick() {
    if (!role) {
      navigate(loginPath(location.pathname + location.search))
      return
    }
    setOpening(true)
    setError(null)
    try {
      const conversation = await openConversation({
        context_type: contextType,
        context_id: contextId,
        supplier_id: supplierId,
      })
      navigate(conversationPath(role, conversation.id), { state: draft ? { draft } : undefined })
    } catch (err) {
      setError(err.userMessage ?? "La conversation n'a pas pu être ouverte.")
      setOpening(false)
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" className={className} onClick={handleClick} disabled={opening}>
        {opening ? 'Ouverture…' : label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  )
}
