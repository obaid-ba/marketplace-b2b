// Mêmes valeurs que App\Enums\UserStatus côté Laravel ; « supprimé » = suppression douce.
export const USER_STATUS = Object.freeze({
  EMAIL_TO_VERIFY: 'e-mail à vérifier',
  ACTIVE: 'actif',
  SUSPENDED: 'suspendu',
  DEACTIVATED: 'désactivé',
  DELETED: 'supprimé',
})

const CONFIG = {
  [USER_STATUS.EMAIL_TO_VERIFY]: { label: 'E-mail à vérifier', variant: 'pending' },
  [USER_STATUS.ACTIVE]: { label: 'Actif', variant: 'success' },
  [USER_STATUS.SUSPENDED]: { label: 'Suspendu', variant: 'danger' },
  [USER_STATUS.DEACTIVATED]: { label: 'Désactivé', variant: 'neutral' },
  [USER_STATUS.DELETED]: { label: 'Supprimé', variant: 'neutral' },
}

export function userStatusConfig(status) {
  return CONFIG[status] ?? { label: status, variant: 'neutral' }
}
