import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDate } from '@/utils/period'

const DEFAULT_LINES = [
  { key: 'signups', label: 'Inscriptions', color: '#5b4bdb' },
  { key: 'orders', label: 'Commandes', color: '#12a06b' },
  { key: 'tenders', label: 'Demandes', color: '#f58a3d' },
]

const shortDate = (value) => formatDate(value).slice(0, 5)

/**
 * Courbe d'évolution commune aux tableaux de bord (Recharts).
 * `lines` permet d'afficher d'autres séries (dépenses, revenu…).
 */
export default function TimeSeriesChart({
  data,
  lines = DEFAULT_LINES,
  ariaLabel = 'Évolution des inscriptions, commandes et demandes sur la période',
  allowDecimals = false,
}) {
  return (
    <div role="img" aria-label={ariaLabel} className="mt-4 h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e3e3ee" />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 12 }} minTickGap={24} />
          <YAxis allowDecimals={allowDecimals} tick={{ fontSize: 12 }} width={40} />
          <Tooltip labelFormatter={(value) => formatDate(value)} />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.label}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
