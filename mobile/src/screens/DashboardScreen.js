import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Badge, Card, Empty, ErrorBox, KpiCard, ListRow, Loading, SectionTitle, WelcomeBanner, statusTone } from '../components/ui'
import useApi from '../hooks/useApi'
import { colors } from '../theme'
import { formatAmount, formatDate, formatNumber, plural, timeAgo } from '../utils/format'

const PRESETS = [
  { label: '30 jours', days: 30 },
  { label: '3 mois', days: 90 },
  { label: '1 an', days: 365 },
]

const toInput = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function lastDays(days) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  return { from: toInput(from), to: toInput(to) }
}

const ENDPOINTS = { buyer: '/buyer/dashboard', supplier: '/supplier/dashboard', admin: '/admin/dashboard' }

/** Cartes d'indicateurs selon le rôle (mêmes chiffres et couleurs que le site). */
function kpisFor(role, data) {
  const k = data.kpis
  const series = data.series ?? []
  const trend = (key) => series.map((day) => Number(day[key]) || 0)

  if (role === 'buyer') {
    return [
      { label: 'Dépenses', value: formatAmount(k.spending), hint: 'Commandes de la période', icon: 'cart', tone: 'violet', trend: trend('spending') },
      { label: 'Commandes', value: formatNumber(k.orders_count), hint: 'Toutes commandes', icon: 'box', tone: 'green', trend: trend('orders') },
      { label: 'En cours', value: formatNumber(k.orders_in_progress), hint: `${formatNumber(k.orders_closed)} terminées`, icon: 'truck', tone: 'orange' },
      { label: 'Demandes publiées', value: formatNumber(k.published_requests), hint: 'Ouvertes ou en négociation', icon: 'file', tone: 'blue' },
      { label: 'Devis en attente', value: formatNumber(k.pending_quotes), hint: 'En attente de réponse', icon: 'inbox', tone: 'pink' },
      { label: 'Fournisseurs favoris', value: formatNumber(k.favorite_suppliers), hint: 'Partenaires de confiance', icon: 'star', tone: 'mint' },
    ]
  }
  if (role === 'supplier') {
    return [
      { label: 'Revenu', value: formatAmount(k.revenue), hint: 'Commandes clôturées', icon: 'cart', tone: 'violet', trend: trend('revenue') },
      { label: 'Commandes', value: formatNumber(k.orders_count), hint: `${formatNumber(k.orders_in_progress)} en cours`, icon: 'box', tone: 'green', trend: trend('orders') },
      { label: 'Devis acceptés', value: `${formatNumber(k.accepted_quote_rate)} %`, hint: `${formatNumber(k.quotes_count)} devis déposés`, icon: 'check', tone: 'orange' },
      { label: 'Note moyenne', value: k.average_rating !== null ? `${k.average_rating} / 5` : '—', hint: `${formatNumber(k.reviews_count)} avis`, icon: 'star', tone: 'mint' },
      { label: 'Vues produits', value: formatNumber(k.views_count), hint: 'Consultations de vos fiches', icon: 'search', tone: 'blue' },
      { label: 'Notifications', value: formatNumber(k.unread_items), hint: 'Non lues', icon: 'bell', tone: 'pink' },
    ]
  }
  return [
    { label: 'Utilisateurs actifs', value: formatNumber(k.active_users), hint: '30 derniers jours', icon: 'users', tone: 'violet' },
    { label: 'Fournisseurs validés', value: formatNumber(k.validated_suppliers), hint: 'Comptes validés', icon: 'check', tone: 'mint' },
    { label: 'Commandes', value: formatNumber(k.orders_count), hint: 'Créées sur la période', icon: 'box', tone: 'green', trend: trend('orders') },
    { label: 'Revenu global', value: formatAmount(k.revenue), hint: 'Commandes clôturées', icon: 'cart', tone: 'orange' },
    { label: 'Demandes', value: formatNumber(k.tenders_count), hint: 'Publiées sur la période', icon: 'file', tone: 'blue', trend: trend('tenders') },
  ]
}

/** Dernières activités (porteur) ; listes à traiter (fournisseur, admin). */
function Activity({ role, data, navigation }) {
  if (role === 'buyer') {
    const items = [
      ...(data.latest_orders ?? []).map((order) => ({ key: `o${order.id}`, date: order.created_at, title: `Commande #${order.id}`, detail: order.supplier, status: order.status, amount: order.total })),
      ...(data.pending_quotes ?? []).map((quote) => ({ key: `q${quote.id}`, date: quote.received_at, title: `Devis reçu de ${quote.supplier ?? 'un fournisseur'}`, detail: quote.tender, status: 'en attente', amount: quote.amount })),
      ...(data.published_requests ?? []).map((tender) => ({ key: `t${tender.id}`, date: tender.created_at, title: 'Nouvelle demande de devis', detail: tender.title, status: tender.status_label ?? tender.status })),
    ]
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6)
    return (
      <Card style={styles.section}>
        <SectionTitle icon="chart" title="Dernières activités" action="Commandes" onAction={() => navigation.navigate('Commandes')} />
        {items.length ? (
          items.map((item, index) => (
            <ListRow
              key={item.key}
              title={item.title}
              detail={`${timeAgo(item.date)}${item.detail ? ` · ${item.detail}` : ''}`}
              badge={<Badge label={item.status} tone={statusTone(item.status)} />}
              amount={item.amount}
              last={index === items.length - 1}
            />
          ))
        ) : (
          <Empty title="Aucune activité récente" />
        )}
      </Card>
    )
  }

  if (role === 'supplier') {
    const requests = data.open_requests ?? []
    return (
      <Card style={styles.section}>
        <SectionTitle icon="inbox" title="Demandes à traiter" action="Tout voir" onAction={() => navigation.navigate('Demandes')} />
        {requests.length ? (
          requests.map((request, index) => (
            <ListRow
              key={request.id ?? index}
              title={request.title}
              detail={`Pertinence ${request.score ?? '—'} % · échéance ${formatDate(request.desired_deadline)}`}
              amount={request.budget}
              last={index === requests.length - 1}
            />
          ))
        ) : (
          <Empty title="Aucune demande en attente" />
        )}
      </Card>
    )
  }

  const queue = data.validation_queue?.items ?? []
  return (
    <Card style={styles.section}>
      <SectionTitle icon="check" title={`Fournisseurs à valider (${data.validation_queue?.count ?? 0})`} />
      {queue.length ? (
        queue.map((item, index) => (
          <ListRow key={item.id} title={item.company_name} detail={item.region ?? item.email} last={index === queue.length - 1} />
        ))
      ) : (
        <Empty title="Aucun dossier en attente" />
      )}
    </Card>
  )
}

/** Tableau de bord commun aux trois rôles : bannière, période, cartes colorées, activité. */
export default function DashboardScreen({ navigation }) {
  const { user } = useAuth()
  const role = user?.role
  const [days, setDays] = useState(30)
  const period = lastDays(days)
  const { data, loading, refreshing, error, reload, refresh } = useApi(
    () => api(ENDPOINTS[role], { params: period }),
    [role, days],
  )

  const title = role === 'admin' ? 'Tableau de bord administrateur' : `Bonjour ${user?.supplier_company_name || user?.name || ''} 👋`
  const subtitle = {
    buyer: 'Gérez vos demandes, vos commandes et avancez sereinement.',
    supplier: "Voici l'activité de votre entreprise : revenus, commandes et demandes reçues.",
    admin: "Vue consolidée de l'activité de la plateforme.",
  }[role]

  return (
    <ScrollView
      style={{ backgroundColor: colors.page }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <WelcomeBanner title={title} subtitle={subtitle} />

      <Card style={styles.section}>
        <SectionTitle icon="chart" title="Période analysée" />
        <Text style={styles.period}>
          {formatDate(period.from)} — {formatDate(period.to)}
        </Text>
        <View style={[styles.row, { marginTop: 10 }]}>
          {PRESETS.map((preset) => (
            <Pressable key={preset.days} onPress={() => setDays(preset.days)} style={[styles.preset, preset.days === days && styles.presetActive]}>
              <Text style={[styles.presetText, preset.days === days && { color: '#fff' }]}>{preset.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {loading && !data ? <Loading /> : null}
      {error && !data ? (
        <View style={styles.section}>
          <ErrorBox message={error} onRetry={reload} />
        </View>
      ) : null}

      {data ? (
        <>
          <View style={[styles.grid, styles.section]}>
            {kpisFor(role, data).map((kpi) => (
              <View key={kpi.label} style={styles.half}>
                <KpiCard {...kpi} />
              </View>
            ))}
          </View>
          {role === 'supplier' && data.negative_review_alert?.active ? (
            <View style={[styles.alert, styles.section]}>
              <Text style={styles.alertText}>
                {plural(data.negative_review_alert.count, 'avis négatif publié')} sur la période (note ≤ 2/5).
              </Text>
            </View>
          ) : null}
          <Activity role={role} data={data} navigation={navigation} />
        </>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  section: { marginTop: 14 },
  period: { fontSize: 13, color: colors.muted },
  preset: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: colors.surface },
  presetActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  presetText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  half: { width: '48.5%', marginBottom: 12 },
  alert: { backgroundColor: '#fff1f2', borderColor: '#fecdd3', borderWidth: 1, borderRadius: 12, padding: 12 },
  alertText: { color: '#9f1239', fontWeight: '600' },
})
