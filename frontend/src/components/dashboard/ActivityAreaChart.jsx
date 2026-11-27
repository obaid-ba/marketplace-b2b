import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatAmount } from '@/utils/money'
import { formatDate } from '@/utils/period'

const MONTHS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

/** Additionne les jours d'un groupe. */
function total(days, valueKey) {
  return days.reduce(
    (sum, day) => ({ orders: sum.orders + (Number(day.orders) || 0), value: sum.value + (Number(day[valueKey]) || 0) }),
    { orders: 0, value: 0 },
  )
}

/**
 * Regroupe les jours pour garder une courbe lisible : jour par jour jusqu'à deux semaines,
 * par semaine jusqu'à trois mois, par mois au-delà.
 */
function prepare(series, valueKey) {
  if (series.length <= 14) {
    return series.map((day) => ({ orders: Number(day.orders) || 0, value: Number(day[valueKey]) || 0, label: formatDate(day.date).slice(0, 5), title: formatDate(day.date) }))
  }

  if (series.length <= 92) {
    const weeks = []
    for (let start = 0; start < series.length; start += 7) {
      const days = series.slice(start, start + 7)
      const first = formatDate(days[0].date)
      const last = formatDate(days.at(-1).date)
      weeks.push({ date: days[0].date, ...total(days, valueKey), label: first.slice(0, 5), title: `Du ${first} au ${last}` })
    }
    return weeks
  }

  const months = new Map()
  for (const day of series) {
    const key = day.date.slice(0, 7)
    const month = months.get(key) ?? { date: key, orders: 0, value: 0 }
    month.orders += Number(day.orders) || 0
    month.value += Number(day[valueKey]) || 0
    months.set(key, month)
  }

  return [...months.values()].map((month) => {
    const [year, index] = month.date.split('-')
    const name = MONTHS[Number(index) - 1]
    return { ...month, label: name, title: `${name} ${year}` }
  })
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-ink">{point.title}</p>
      <p className="mt-1 font-semibold text-brand-600">{formatAmount(point.value)}</p>
      <p className="text-muted">
        {point.orders} commande{point.orders > 1 ? 's' : ''}
      </p>
    </div>
  )
}

/**
 * Courbe d'un montant de la période (aire violette), avec le nombre de commandes au survol.
 * valueKey : champ du montant dans la série (« spending » pour un acheteur, « revenue » pour un fournisseur).
 */
export default function ActivityAreaChart({
  series,
  valueKey = 'spending',
  ariaLabel = 'Évolution des dépenses et des commandes sur la période',
}) {
  const data = prepare(series, valueKey)

  return (
    <div role="img" aria-label={ariaLabel} className="mt-4 h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6d5fe0" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6d5fe0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#ececf4" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5f6078' }} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis
            tick={{ fontSize: 12, fill: '#5f6078' }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(value) => (value >= 1000 ? `${Math.round(value / 100) / 10}k` : value)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#b9b2f4', strokeDasharray: '4 4' }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#5b4bdb"
            strokeWidth={2.5}
            fill="url(#activity-fill)"
            dot={data.length > 20 ? false : { r: 4, fill: '#5b4bdb', stroke: '#ffffff', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#5b4bdb', stroke: '#ffffff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
