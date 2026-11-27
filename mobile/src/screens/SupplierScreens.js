import { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { api, mediaUrl } from '../api/client'
import Icon from '../components/Icon'
import PromptModal from '../components/PromptModal'
import { Badge, Button, Card, ErrorBox, Loading, statusTone } from '../components/ui'
import { WEB_URL } from '../config'
import useApi from '../hooks/useApi'
import { colors, radius } from '../theme'
import { formatAmount, formatDate, timeAgo } from '../utils/format'
import { styles as shared } from './BuyerScreens'
import { ApiList } from './ListScreens'

/** Mes devis (fournisseur). */
export function QuotesScreen() {
  return (
    <ApiList
      fetcher={() => api('/supplier/quotes', { params: { per_page: 30 } })}
      emptyTitle="Aucun devis"
      emptyText="Répondez aux demandes reçues pour déposer un devis."
      renderItem={({ item }) => (
        <Card>
          <View style={shared.rowBetween}>
            <Text style={[shared.name, { flex: 1, marginRight: 8 }]} numberOfLines={1}>
              {item.tender?.title ?? 'Demande'}
            </Text>
            <Badge label={item.status_label ?? item.status} tone={statusTone(item.status)} />
          </View>
          <Text style={styles.amount}>{formatAmount(item.amount)}</Text>
          <Text style={shared.hint}>
            Livraison en {item.delivery_days} jour{item.delivery_days > 1 ? 's' : ''} · déposé {timeAgo(item.created_at)}
          </Text>
          {item.conditions ? (
            <Text style={shared.body} numberOfLines={2}>
              {item.conditions}
            </Text>
          ) : null}
        </Card>
      )}
    />
  )
}

/** Mes avis : note moyenne, résumé IA, avis avec réponse du fournisseur. */
export function ReviewsScreen() {
  const [replying, setReplying] = useState(null)
  const { data, loading, error, reload } = useApi(() => api('/supplier/reviews', { params: { per_page: 30 } }))

  if (loading && !data) return <Loading />
  if (error && !data) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorBox message={error} onRetry={reload} />
      </View>
    )
  }

  const reviews = data?.reviews?.data ?? []
  const summary = data?.ai_summary

  return (
    <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Card>
        <View style={shared.row}>
          <Text style={styles.big}>{data?.rating_avg ? Number(data.rating_avg).toFixed(2) : '—'}</Text>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.stars}>{'★'.repeat(Math.round(data?.rating_avg ?? 0)).padEnd(5, '☆')}</Text>
            <Text style={shared.hint}>{data?.reviews_count ?? 0} avis publiés</Text>
          </View>
        </View>
        {summary ? (
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{summary.simulated ? 'Résumé automatique (mode simulé)' : 'Résumé généré par IA'}</Text>
            <Text style={shared.body}>{summary.summary}</Text>
            {summary.strengths?.length ? <Text style={[shared.hint, { color: colors.success }]}>+ {summary.strengths.join(' · ')}</Text> : null}
            {summary.weaknesses?.length ? <Text style={[shared.hint, { color: colors.danger }]}>− {summary.weaknesses.join(' · ')}</Text> : null}
          </View>
        ) : null}
      </Card>

      {reviews.map((review) => (
        <Card key={review.id} style={{ marginTop: 12 }}>
          <View style={shared.rowBetween}>
            <Text style={styles.stars}>{'★'.repeat(review.rating).padEnd(5, '☆')}</Text>
            <Text style={shared.hint}>{formatDate(review.created_at)}</Text>
          </View>
          {review.comment ? <Text style={shared.body}>« {review.comment} »</Text> : null}
          {review.supplier_reply ? (
            <View style={styles.reply}>
              <Text style={styles.replyTitle}>Votre réponse</Text>
              <Text style={shared.body}>{review.supplier_reply}</Text>
            </View>
          ) : (
            <Pressable onPress={() => setReplying(review)} style={[shared.row, { marginTop: 10 }]}>
              <Icon name="reply" size={16} color={colors.brand600} />
              <Text style={[shared.link, { marginLeft: 6 }]}>Répondre</Text>
            </Pressable>
          )}
        </Card>
      ))}

      <PromptModal
        visible={!!replying}
        title="Répondre à l'avis"
        message="Votre réponse sera visible publiquement sous l'avis."
        placeholder="Merci pour votre retour…"
        confirmLabel="Publier"
        minLength={2}
        onClose={() => setReplying(null)}
        onSubmit={async (reply) => {
          await api(`/supplier/reviews/${replying.id}/reply`, { method: 'POST', body: { reply } })
          reload()
        }}
      />
    </ScrollView>
  )
}

/** Profil de l'entreprise (lecture ; modification sur le site, avec les justificatifs). */
export function CompanyProfileScreen() {
  const { data, loading, error, reload } = useApi(() => api('/supplier/profile'))

  if (loading && !data) return <Loading />
  if (error && !data) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorBox message={error} onRetry={reload} />
      </View>
    )
  }

  const rows = [
    ['Secteur', data.sector],
    ['Région', data.region?.name],
    ['E-mail professionnel', data.professional_email],
    ['Téléphone', data.professional_phone],
    ['Catégories', data.categories?.map((category) => category.name).join(', ')],
    ['Zones couvertes', data.coverage_regions?.map((region) => region.name).join(', ')],
  ].filter(([, value]) => value)

  return (
    <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Card style={{ alignItems: 'center' }}>
        {data.logo_url ? (
          <Image source={{ uri: mediaUrl(data.logo_url) }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, shared.center]}>
            <Icon name="building" size={32} color={colors.brand600} />
          </View>
        )}
        <Text style={[shared.title, { marginTop: 12, textAlign: 'center' }]}>{data.company_name}</Text>
        <View style={[shared.row, { marginTop: 8 }]}>
          <Badge label={data.validation_status} tone={statusTone(data.validation_status === 'validé' ? 'validé' : data.validation_status)} />
          <View style={{ width: 8 }} />
          <Badge label={data.is_published ? 'Visible dans le catalogue' : 'Non publié'} tone={data.is_published ? 'green' : 'orange'} />
        </View>
        {data.rejection_reason ? <Text style={[shared.error, { marginTop: 8 }]}>Motif du refus : {data.rejection_reason}</Text> : null}
      </Card>

      {data.description ? (
        <Card style={{ marginTop: 12 }}>
          <Text style={shared.label}>Présentation</Text>
          <Text style={shared.body}>{data.description}</Text>
        </Card>
      ) : null}

      <Card style={{ marginTop: 12 }}>
        {rows.map(([label, value], index) => (
          <View key={label} style={[styles.line, index < rows.length - 1 && styles.divider]}>
            <Text style={shared.hint}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </Card>

      <Button title="Modifier sur le site" icon="arrow" variant="secondary" style={{ marginTop: 16 }} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/fournisseur/profil`)} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  amount: { marginTop: 6, fontSize: 18, fontWeight: '800', color: colors.brand600 },
  big: { fontSize: 36, fontWeight: '800', color: colors.ink },
  stars: { fontSize: 16, color: '#f5a524', letterSpacing: 1 },
  summary: { marginTop: 14, backgroundColor: colors.brand50, borderRadius: radius.md, padding: 12 },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: colors.brand600 },
  reply: { marginTop: 10, borderLeftWidth: 3, borderLeftColor: colors.brand500, paddingLeft: 10 },
  replyTitle: { fontSize: 12, fontWeight: '700', color: colors.brand600 },
  logo: { width: 84, height: 84, borderRadius: 20, backgroundColor: colors.brand50 },
  line: { paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  value: { marginTop: 2, fontSize: 14, fontWeight: '600', color: colors.ink },
})
