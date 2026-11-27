import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useUnread } from '../sync/UnreadContext'
import Icon from '../components/Icon'
import { Badge, Card, Empty, ErrorBox, ListRow, Loading, statusTone } from '../components/ui'
import useApi from '../hooks/useApi'
import { colors } from '../theme'
import { formatAmount, formatDate, plural, rows, timeAgo } from '../utils/format'

/** Liste générique : chargement, erreur, tirer pour rafraîchir, état vide. */
export function ApiList({ fetcher, deps = [], renderItem, emptyTitle, emptyText, header, pollMs, extract = rows }) {
  const { data, loading, refreshing, error, reload, refresh } = useApi(fetcher, deps, { pollMs })
  const items = extract(data)

  if (loading && !data) return <Loading />
  if (error && !data) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorBox message={error} onRetry={reload} />
      </View>
    )
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.page }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      data={items}
      keyExtractor={(item, index) => String(item.id ?? item.recipient_id ?? index)}
      renderItem={renderItem}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListEmptyComponent={<Empty title={emptyTitle} text={emptyText} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    />
  )
}

/** Mes demandes (porteur de projet). */
export function BuyerTendersScreen() {
  return (
    <ApiList
      fetcher={() => api('/buyer/tenders', { params: { per_page: 30 } })}
      emptyTitle="Aucune demande"
      emptyText="Publiez une demande depuis le site pour recevoir des devis."
      renderItem={({ item }) => (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Badge label={item.status_label ?? item.status} tone={statusTone(item.status)} />
          </View>
          <Text style={styles.detail}>
            {item.category?.name ?? 'Sans catégorie'} · {item.region?.name ?? 'Toute la Tunisie'}
          </Text>
          <View style={[styles.rowBetween, { marginTop: 10 }]}>
            <Text style={styles.strong}>{plural(item.quotes_count ?? 0, 'devis reçu', 'devis reçus')}</Text>
            <Text style={styles.detail}>échéance {formatDate(item.desired_deadline)}</Text>
          </View>
          {item.budget ? <Text style={styles.amount}>Budget {formatAmount(item.budget)}</Text> : null}
        </Card>
      )}
    />
  )
}

/** Demandes reçues (fournisseur), classées par pertinence. */
export function SupplierTendersScreen() {
  return (
    <ApiList
      fetcher={() => api('/supplier/tenders', { params: { per_page: 30 } })}
      emptyTitle="Aucune demande reçue"
      emptyText="Les demandes qui correspondent à vos catégories apparaîtront ici."
      renderItem={({ item }) => (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.title} numberOfLines={1}>
              {item.tender?.title}
            </Text>
            <Badge label={`${item.score ?? '—'} %`} tone="violet" />
          </View>
          <Text style={styles.detail}>
            Échéance {formatDate(item.tender?.desired_deadline)}
            {item.tender?.budget ? ` · budget ${formatAmount(item.tender.budget)}` : ''}
          </Text>
          <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            {item.already_responded ? (
              <Badge label={`Devis ${item.my_quote?.status_label?.toLowerCase() ?? 'envoyé'} · ${formatAmount(item.my_quote?.amount)}`} tone="green" />
            ) : (
              <Badge label="À répondre" tone="orange" />
            )}
          </View>
        </Card>
      )}
    />
  )
}

/** Mes produits (fournisseur). */
export function SupplierProductsScreen() {
  return (
    <ApiList
      fetcher={() => api('/supplier/products', { params: { per_page: 50 } })}
      emptyTitle="Aucun produit"
      emptyText="Ajoutez vos produits depuis le site."
      renderItem={({ item }) => (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Badge
              label={{ published: 'Publié', draft: 'Brouillon', withdrawn: 'Retiré' }[item.status] ?? item.status}
              tone={{ published: 'green', draft: 'orange', withdrawn: 'red' }[item.status] ?? 'violet'}
            />
          </View>
          <Text style={styles.detail}>
            {item.category?.name} · {item.views_count ?? 0} vues{item.is_featured ? ' · ★ mis en avant' : ''}
          </Text>
          <Text style={styles.amount}>{item.price !== null ? formatAmount(item.price) : 'Prix sur devis'}</Text>
          {item.withdrawal_reason ? <Text style={[styles.detail, { color: colors.danger }]}>Motif : {item.withdrawal_reason}</Text> : null}
        </Card>
      )}
    />
  )
}

/** Commandes (porteur ou fournisseur). */
export function OrdersScreen() {
  const { user } = useAuth()
  const buyer = user?.role === 'buyer'
  return (
    <ApiList
      fetcher={() => api(buyer ? '/buyer/orders' : '/supplier/orders', { params: { per_page: 30 } })}
      deps={[buyer]}
      emptyTitle="Aucune commande"
      emptyText="Vos commandes apparaîtront ici."
      renderItem={({ item }) => (
        <Card>
          <ListRow
            title={`Commande #${item.id}`}
            detail={`${buyer ? item.supplier?.company_name ?? 'Fournisseur' : item.buyer?.organization ?? item.buyer?.user?.name ?? 'Client'} · ${formatDate(item.created_at)}`}
            badge={<Badge label={item.status} tone={statusTone(item.status)} />}
            amount={item.total}
            last
          />
          {item.items?.length ? (
            <Text style={styles.detail} numberOfLines={2}>
              {item.items.map((line) => `${line.quantity} × ${line.label}`).join(', ')}
            </Text>
          ) : null}
        </Card>
      )}
    />
  )
}

/** Notifications, avec « Tout marquer comme lu ». */
export function NotificationsScreen() {
  const [version, setVersion] = useState(0)
  const unread = useUnread()
  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' }).catch(() => {})
    setVersion((current) => current + 1)
    unread.refresh()
  }
  return (
    <ApiList
      fetcher={() => api('/notifications', { params: { per_page: 30 } })}
      deps={[version]}
      pollMs={30000}
      emptyTitle="Aucune notification"
      header={
        <Pressable onPress={markAll} style={[styles.row, { alignSelf: 'flex-end', marginBottom: 10 }]} hitSlop={8}>
          <Icon name="check" size={16} color={colors.brand600} />
          <Text style={styles.link}>Tout marquer comme lu</Text>
        </Pressable>
      }
      renderItem={({ item }) => (
        <Card style={!item.read_at && { borderColor: colors.brand100, backgroundColor: '#fbfaff' }}>
          <View style={styles.row}>
            {!item.read_at && <View style={styles.dot} />}
            <Text style={[styles.title, { flex: 1 }]}>{item.title}</Text>
          </View>
          {item.message ? <Text style={styles.detail}>{item.message}</Text> : null}
          <Text style={[styles.detail, { marginTop: 6 }]}>{timeAgo(item.created_at)}</Text>
        </Card>
      )}
    />
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink, flexShrink: 1, marginRight: 8 },
  detail: { marginTop: 4, fontSize: 13, color: colors.muted },
  strong: { fontSize: 13, fontWeight: '700', color: colors.brand600 },
  amount: { marginTop: 6, fontSize: 14, fontWeight: '700', color: colors.ink },
  link: { marginLeft: 6, color: colors.brand600, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand600, marginRight: 8 },
})
