import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { api } from '../api/client'
import PromptModal from '../components/PromptModal'
import { Badge, Button, Card, ErrorBox, Loading, statusTone } from '../components/ui'
import { WEB_URL } from '../config'
import useApi from '../hooks/useApi'
import { colors } from '../theme'
import { formatAmount, formatDate, plural, timeAgo } from '../utils/format'
import { confirmAction, styles as shared } from './BuyerScreens'
import { ApiList } from './ListScreens'

/** Onglets de filtre (statut) au-dessus d'une liste. */
function Filters({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      {options.map(([key, label]) => (
        <Pressable key={key} onPress={() => onChange(key)} style={[shared.chip, key === value && shared.chipActive]}>
          <Text style={[shared.chipText, key === value && { color: '#fff' }]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

/** Petit bouton d'action dans une carte. */
function Action({ label, tone = 'primary', onPress }) {
  return <Button title={label} variant={tone === 'primary' ? 'primary' : 'secondary'} onPress={onPress} style={styles.action} />
}

/** Validation des fournisseurs : dossiers en attente, validation ou refus motivé. */
export function SupplierValidationScreen() {
  const [status, setStatus] = useState('en attente')
  const [version, setVersion] = useState(0)
  const [rejecting, setRejecting] = useState(null)
  const done = () => setVersion((current) => current + 1)

  return (
    <>
      <ApiList
        fetcher={() => api('/admin/suppliers', { params: { status, per_page: 30 } })}
        deps={[status, version]}
        emptyTitle="Aucun dossier"
        header={
          <Filters
            options={[
              ['en attente', 'En attente'],
              ['validé', 'Validés'],
              ['refusé', 'Refusés'],
            ]}
            value={status}
            onChange={setStatus}
          />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={shared.rowBetween}>
              <Text style={[shared.name, { flex: 1, marginRight: 8 }]}>{item.company_name}</Text>
              <Badge label={item.validation_status} tone={statusTone(item.validation_status)} />
            </View>
            <Text style={shared.hint}>
              {item.sector ?? 'Secteur non précisé'} · {item.professional_email ?? ''}
            </Text>
            {item.description ? (
              <Text style={shared.body} numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}
            {item.rejection_reason ? <Text style={shared.error}>Motif : {item.rejection_reason}</Text> : null}
            {item.validation_status === 'en attente' ? (
              <View style={styles.actions}>
                <Action
                  label="Valider"
                  onPress={() =>
                    confirmAction('Valider le fournisseur', item.company_name, async () => {
                      await api(`/admin/suppliers/${item.id}/approve`, { method: 'POST' }).catch(() => {})
                      done()
                    })
                  }
                />
                <Action label="Refuser" tone="secondary" onPress={() => setRejecting(item)} />
              </View>
            ) : null}
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/admin/fournisseurs/${item.id}`)} style={{ marginTop: 10 }}>
              <Text style={shared.link}>Voir le dossier et les justificatifs →</Text>
            </Pressable>
          </Card>
        )}
      />
      <PromptModal
        visible={!!rejecting}
        title="Refuser le dossier"
        message="Le motif est envoyé au fournisseur."
        placeholder="Justificatif illisible, informations incomplètes…"
        confirmLabel="Refuser"
        minLength={5}
        onClose={() => setRejecting(null)}
        onSubmit={async (reason) => {
          await api(`/admin/suppliers/${rejecting.id}/reject`, { method: 'POST', body: { reason } })
          done()
        }}
      />
    </>
  )
}

/** Utilisateurs : recherche par rôle, suspension motivée, réactivation. */
export function UsersScreen() {
  const [role, setRole] = useState('')
  const [version, setVersion] = useState(0)
  const [suspending, setSuspending] = useState(null)
  const done = () => setVersion((current) => current + 1)

  return (
    <>
      <ApiList
        fetcher={() => api('/admin/users', { params: { role, per_page: 50 } })}
        deps={[role, version]}
        emptyTitle="Aucun utilisateur"
        header={
          <Filters
            options={[
              ['', 'Tous'],
              ['buyer', 'Porteurs'],
              ['supplier', 'Fournisseurs'],
              ['admin', 'Admins'],
            ]}
            value={role}
            onChange={setRole}
          />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={shared.rowBetween}>
              <Text style={[shared.name, { flex: 1, marginRight: 8 }]}>{item.name}</Text>
              <Badge label={item.status} tone={item.status === 'actif' ? 'green' : 'red'} />
            </View>
            <Text style={shared.hint}>
              {item.role_label} · {item.email}
            </Text>
            <Text style={shared.hint}>
              {item.organization ?? item.supplier?.company_name ?? ''} · inscrit le {formatDate(item.created_at)}
              {item.last_login_at ? ` · vu ${timeAgo(item.last_login_at)}` : ''}
            </Text>
            {item.locked_reason ? <Text style={shared.hint}>{item.locked_reason}</Text> : null}
            {item.can_suspend || item.can_reactivate ? (
              <View style={styles.actions}>
                {item.can_suspend ? <Action label="Suspendre" tone="secondary" onPress={() => setSuspending(item)} /> : null}
                {item.can_reactivate ? (
                  <Action
                    label="Réactiver"
                    onPress={() =>
                      confirmAction('Réactiver le compte', item.name, async () => {
                        await api(`/admin/users/${item.id}/reactivate`, { method: 'POST', body: { reason: 'Réactivation depuis l’application mobile.' } }).catch(() => {})
                        done()
                      })
                    }
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        )}
      />
      <PromptModal
        visible={!!suspending}
        title="Suspendre le compte"
        message="L'utilisateur est déconnecté et ne peut plus se connecter. Le motif est enregistré dans le journal d'audit."
        placeholder="Motif (10 caractères minimum)"
        confirmLabel="Suspendre"
        minLength={10}
        onClose={() => setSuspending(null)}
        onSubmit={async (reason) => {
          await api(`/admin/users/${suspending.id}/suspend`, { method: 'POST', body: { reason } })
          done()
        }}
      />
    </>
  )
}

/** Arbre des catégories (lecture ; création et déplacement sur le site). */
export function CategoriesScreen() {
  const { data, loading, error, reload } = useApi(() => api('/admin/categories'))
  if (loading && !data) return <Loading />
  if (error && !data) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorBox message={error} onRetry={reload} />
      </View>
    )
  }
  return (
    <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {(data ?? []).map((category) => (
        <Card key={category.id} style={{ marginBottom: 12 }}>
          <View style={shared.rowBetween}>
            <Text style={shared.name}>{category.name}</Text>
            <Text style={shared.hint}>{plural(category.products_count ?? 0, 'produit')}</Text>
          </View>
          {category.children?.map((child) => (
            <View key={child.id} style={[shared.rowBetween, styles.child]}>
              <Text style={styles.childName}>↳ {child.name}</Text>
              <Text style={shared.hint}>{child.products_count ?? 0}</Text>
            </View>
          ))}
        </Card>
      ))}
      <Button title="Gérer les catégories sur le site" icon="arrow" variant="secondary" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/admin/categories`)} />
    </ScrollView>
  )
}

/** Contrôle du catalogue : produits signalés par l'IA en premier, retrait motivé. */
export function ProductControlScreen() {
  const [version, setVersion] = useState(0)
  const [withdrawing, setWithdrawing] = useState(null)
  return (
    <>
      <ApiList
        fetcher={() => api('/admin/products', { params: { per_page: 40 } })}
        deps={[version]}
        emptyTitle="Aucun produit"
        renderItem={({ item }) => (
          <Card style={item.ai_flag_reason && item.status !== 'retiré' && { borderColor: '#fecdd3' }}>
            <View style={shared.rowBetween}>
              <Text style={[shared.name, { flex: 1, marginRight: 8 }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Badge label={item.status} tone={statusTone(item.status)} />
            </View>
            <Text style={shared.hint}>
              {item.supplier?.company_name ?? `Fournisseur #${item.supplier_id}`} · {item.price !== null ? formatAmount(item.price) : 'sur devis'}
            </Text>
            {item.ai_flag_reason ? <Text style={[shared.error, { marginTop: 6 }]}>⚠ IA : {item.ai_flag_reason}</Text> : null}
            {item.withdrawal_reason ? <Text style={shared.hint}>Retiré : {item.withdrawal_reason}</Text> : null}
            {item.status !== 'retiré' ? (
              <View style={styles.actions}>
                <Action label="Retirer du catalogue" tone="secondary" onPress={() => setWithdrawing(item)} />
              </View>
            ) : null}
          </Card>
        )}
      />
      <PromptModal
        visible={!!withdrawing}
        title="Retirer le produit"
        message="Le fournisseur reçoit le motif."
        placeholder="Photos ne correspondant pas au produit…"
        confirmLabel="Retirer"
        minLength={5}
        onClose={() => setWithdrawing(null)}
        onSubmit={async (reason) => {
          await api(`/admin/products/${withdrawing.id}/withdraw`, { method: 'POST', body: { reason } })
          setVersion((current) => current + 1)
        }}
      />
    </>
  )
}

/** Avis signalés : conserver ou masquer. */
export function ReportedReviewsScreen() {
  const [version, setVersion] = useState(0)
  const moderate = (review, action) =>
    confirmAction(action === 'hide' ? "Masquer l'avis" : "Conserver l'avis", review.comment ?? '', async () => {
      await api(`/admin/reported-reviews/${review.id}/${action}`, { method: 'POST', body: {} }).catch(() => {})
      setVersion((current) => current + 1)
    })

  return (
    <ApiList
      fetcher={() => api('/admin/reported-reviews', { params: { per_page: 30 } })}
      deps={[version]}
      emptyTitle="Aucun avis signalé"
      renderItem={({ item }) => (
        <Card>
          <View style={shared.rowBetween}>
            <Text style={{ color: '#f5a524', fontSize: 16 }}>{'★'.repeat(item.rating).padEnd(5, '☆')}</Text>
            <Badge label={item.status} tone={statusTone(item.status === 'signalé' ? 'en attente' : item.status)} />
          </View>
          {item.comment ? <Text style={shared.body}>« {item.comment} »</Text> : null}
          <Text style={shared.hint}>
            {item.buyer?.organization ?? 'Acheteur'} → {item.supplier?.company_name ?? 'Fournisseur'} · {plural(item.pending_reports_count ?? 0, 'signalement')}
            {item.ai_suspicion_score ? ` · suspicion IA ${Math.round(item.ai_suspicion_score)}/100` : ''}
          </Text>
          {item.status === 'signalé' ? (
            <View style={styles.actions}>
              <Action label="Conserver" tone="secondary" onPress={() => moderate(item, 'keep')} />
              <Action label="Masquer" onPress={() => moderate(item, 'hide')} />
            </View>
          ) : null}
        </Card>
      )}
    />
  )
}

/** Journal d'audit des actions des administrateurs. */
export function AuditScreen() {
  return (
    <ApiList
      fetcher={() => api('/admin/audit-logs', { params: { per_page: 50 } })}
      emptyTitle="Journal vide"
      renderItem={({ item }) => (
        <Card>
          <View style={shared.rowBetween}>
            <Text style={[shared.name, { flex: 1, marginRight: 8 }]}>{item.action}</Text>
            <Text style={shared.hint}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={shared.hint}>
            {item.admin?.name} · {item.target}
          </Text>
          {item.reason ? (
            <Text style={shared.body} numberOfLines={3}>
              {item.reason}
            </Text>
          ) : null}
        </Card>
      )}
    />
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', marginTop: 12 },
  action: { flex: 1, height: 42, marginRight: 8 },
  child: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 6 },
  childName: { fontSize: 14, color: colors.ink },
})
