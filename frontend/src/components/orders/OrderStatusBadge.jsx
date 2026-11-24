export const ORDER_STATUS_CONFIG = {
  validée: {
    label: 'Validée',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    step: 1,
  },
  'en préparation': {
    label: 'En préparation',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    step: 1,
  },
  'en livraison': {
    label: 'En livraison',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    step: 2,
  },
  expédiée: {
    label: 'Expédiée',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    step: 2,
  },
  livrée: {
    label: 'Livrée',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    step: 3,
  },
  clôturée: {
    label: 'Clôturée',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    step: 4,
  },
}

export function OrderStatusBadge({ status }) {
  const config = ORDER_STATUS_CONFIG[status] ?? {
    label: status ?? 'Inconnu',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.bg} ${config.text} ${config.border}`}
    >
      {config.label}
    </span>
  )
}

export function OrderStatusProgress({ status, statusHistory = [] }) {
  const steps = [
    { key: 'validée', label: 'Validée', num: 1 },
    { key: 'expédiée', label: 'Expédiée', num: 2 },
    { key: 'livrée', label: 'Livrée', num: 3 },
    { key: 'clôturée', label: 'Clôturée', num: 4 },
  ]

  const currentStep = ORDER_STATUS_CONFIG[status]?.step ?? 1

  // Indexe les dates des étapes franchies à partir de status_history / statusHistory
  const historyMap = {}
  if (Array.isArray(statusHistory)) {
    statusHistory.forEach((h) => {
      if (h.status && h.changed_at) {
        historyMap[h.status] = h.changed_at
      }
    })
  }

  return (
    <div className="w-full">
      <ol className="grid grid-cols-4 text-xs font-medium text-slate-500">
        {steps.map((step, idx) => {
          const isPassed = currentStep >= step.num
          const isCurrent = currentStep === step.num
          const dateStr = historyMap[step.key]
            ? new Date(historyMap[step.key]).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : null

          return (
            <li key={step.key} aria-current={isCurrent ? 'step' : undefined} className="relative min-w-0">
              {/* Trait jusqu'à l'étape suivante, entre les deux pastilles */}
              {idx < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`absolute top-3 left-[calc(50%+1.25rem)] h-1 w-[calc(100%-2.5rem)] rounded transition ${
                    currentStep > step.num ? 'bg-brand-600' : 'bg-slate-200'
                  }`}
                />
              )}
              <div className="flex flex-col items-center text-center">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                    isPassed
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  } ${isCurrent ? 'ring-4 ring-brand-100 font-extrabold' : ''}`}
                >
                  {isPassed && currentStep > step.num ? '✓' : step.num}
                </span>
                <span
                  className={`mt-1.5 text-xs ${
                    isCurrent
                      ? 'font-bold text-brand-700'
                      : isPassed
                      ? 'font-medium text-slate-800'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
                {dateStr ? (
                  <span className="mt-0.5 text-[11px] text-slate-500 font-mono">
                    {dateStr}
                  </span>
                ) : isCurrent ? (
                  <span className="mt-0.5 text-[10px] text-brand-600 font-medium">
                    {step.num === steps.length ? '(Terminée)' : '(En cours)'}
                  </span>
                ) : (
                  <span className="mt-0.5 text-[10px] text-slate-300">—</span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
