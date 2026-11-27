import { useState } from 'react'
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { api, mediaUrl } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import Icon from '../components/Icon'
import { Badge, Button, Card, statusTone } from '../components/ui'
import { WEB_URL } from '../config'
import useApi from '../hooks/useApi'
import { colors, radius } from '../theme'
import { formatAmount, formatDate } from '../utils/format'
import { ApiList } from './ListScreens'

/** Confirmation (Alert sur téléphone, confirm() dans le navigateur). */
export function confirmAction(title, message, onConfirm) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${message}`)) onConfirm()
    return
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Confirmer', style: 'destructive', onPress: onConfirm },
  ])
}

function Field({ label, hint, error, children }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

function Chips({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
      {options.map((option) => {
        const active = String(option.id) === String(value)
        return (
          <Pressable key={option.id} onPress={() => onChange(active ? '' : option.id)} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && { color: '#fff' }]}>{option.name}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

/** Publier une demande de devis (mêmes champs et règles que le site ; les pièces jointes se font sur le site). */
export function PublishTenderScreen({ navigation }) {
  const categories = useApi(() => api('/reference/categories'))
  const regions = useApi(() => api('/reference/regions'))
  const [form, setForm] = useState({ title: '', description: '', category_id: '', region_id: '', budget: '', desired_deadline: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }))

  // Liste plate de l'API : on propose les catégories sans sous-catégorie, comme le formulaire du site.
  const all = Array.isArray(categories.data) ? categories.data : []
  const parents = new Set(all.map((category) => category.parent_id).filter(Boolean))
  const flat = all.filter((category) => !parents.has(category.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  async function submit() {
    setLoading(true)
    setErrors({})
    setMessage(null)
    try {
      await api('/buyer/tenders', {
        method: 'POST',
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
          category_id: form.category_id || null,
          region_id: form.region_id || null,
          budget: form.budget ? Number(form.budget.replace(',', '.')) : null,
          desired_deadline: form.desired_deadline || null,
        },
      })
      navigation.navigate('Demandes')
    } catch (error) {
      setErrors(error.errors ?? {})
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.title}>Publier une demande</Text>
        <Text style={styles.hint}>Les fournisseurs des catégories choisies sont notifiés automatiquement.</Text>

        <Field label="Titre" error={errors.title?.[0]}>
          <TextInput style={styles.input} value={form.title} onChangeText={set('title')} placeholder="Ex. 2 000 cartons d'emballage" placeholderTextColor="#9a9bb0" />
        </Field>
        <Field label="Description du besoin" hint="20 caractères minimum." error={errors.description?.[0]}>
          <TextInput
            style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
            multiline
            value={form.description}
            onChangeText={set('description')}
            placeholder="Quantités, caractéristiques, lieu de livraison…"
            placeholderTextColor="#9a9bb0"
          />
        </Field>
        <Field label="Catégorie" error={errors.category_id?.[0]}>
          <Chips options={flat} value={form.category_id} onChange={set('category_id')} />
        </Field>
        <Field label="Région (facultatif)" error={errors.region_id?.[0]}>
          <Chips options={Array.isArray(regions.data) ? regions.data : []} value={form.region_id} onChange={set('region_id')} />
        </Field>
        <Field label="Budget en TND (facultatif)" error={errors.budget?.[0]}>
          <TextInput style={styles.input} value={form.budget} onChangeText={set('budget')} keyboardType="decimal-pad" placeholder="4500" placeholderTextColor="#9a9bb0" />
        </Field>
        <Field label="Échéance souhaitée (facultatif)" hint="Format AAAA-MM-JJ, après aujourd'hui." error={errors.desired_deadline?.[0]}>
          <TextInput style={styles.input} value={form.desired_deadline} onChangeText={set('desired_deadline')} placeholder="2026-12-31" placeholderTextColor="#9a9bb0" />
        </Field>

        {message && !Object.keys(errors).length ? <Text style={[styles.error, { marginTop: 12 }]}>{message}</Text> : null}
        <Button title="Publier la demande" icon="arrow" onPress={submit} loading={loading} style={{ marginTop: 18 }} />
      </Card>
    </ScrollView>
  )
}

/** Fournisseurs favoris, avec retrait. */
export function FavoritesScreen({ navigation }) {
  const [version, setVersion] = useState(0)
  const remove = (supplier) =>
    confirmAction('Retirer des favoris', supplier.company_name, async () => {
      await api(`/favorites/suppliers/${supplier.id}`, { method: 'DELETE' }).catch(() => {})
      setVersion((current) => current + 1)
    })

  return (
    <ApiList
      fetcher={() => api('/favorites/suppliers')}
      deps={[version]}
      emptyTitle="Aucun favori"
      emptyText="Ajoutez des fournisseurs de confiance depuis le catalogue."
      renderItem={({ item }) => (
        <Card>
          <View style={styles.row}>
            {item.logo_url ? (
              <Image source={{ uri: mediaUrl(item.logo_url) }} style={styles.logo} />
            ) : (
              <View style={[styles.logo, styles.center]}>
                <Icon name="building" color={colors.brand600} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{item.company_name}</Text>
              <Text style={styles.hint}>
                {item.region}
                {item.rating_avg ? ` · ★ ${Number(item.rating_avg).toFixed(1)}` : ''} · {item.reviews_count ?? 0} avis
              </Text>
              {item.categories?.length ? (
                <Text style={styles.hint} numberOfLines={1}>
                  {item.categories.join(', ')}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => remove(item)} hitSlop={10} accessibilityLabel="Retirer des favoris">
              <Icon name="heart" color={colors.danger} />
            </Pressable>
          </View>
          <Pressable onPress={() => navigation.navigate('Catalogue', { supplier: item.id })} style={{ marginTop: 10 }}>
            <Text style={styles.link}>Voir le catalogue →</Text>
          </Pressable>
        </Card>
      )}
    />
  )
}

/** Litiges : ceux de l'acheteur, ou ceux reçus par le fournisseur (même adresse d'API). */
export function DisputesScreen() {
  const { user } = useAuth()
  const admin = user?.role === 'admin'
  return (
    <ApiList
      fetcher={() => api(admin ? '/admin/disputes' : '/disputes', { params: { per_page: 30 } })}
      deps={[admin]}
      emptyTitle="Aucun litige"
      emptyText="Les litiges ouverts sur vos commandes apparaîtront ici."
      renderItem={({ item }) => (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={[styles.name, { flex: 1, marginRight: 8 }]} numberOfLines={1}>
              {item.reason}
            </Text>
            <Badge label={item.status} tone={statusTone(item.status === 'ouvert' ? 'en attente' : item.status === 'décidé' ? 'clôturé' : 'en cours')} />
          </View>
          <Text style={styles.hint}>
            Commande #{item.order_id} · {formatAmount(item.order?.total)} · {formatDate(item.created_at)}
          </Text>
          <Text style={styles.hint}>
            {item.buyer?.name} → {item.supplier?.name}
          </Text>
          {item.description ? (
            <Text style={styles.body} numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}
          {admin && !item.decision ? (
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/admin/litiges/${item.id}`)} style={{ marginTop: 10 }}>
              <Text style={styles.link}>Traiter sur le site →</Text>
            </Pressable>
          ) : null}
          {item.decision ? (
            <View style={styles.decision}>
              <Text style={styles.decisionText}>
                Décision : {item.decision}
                {item.decision_note ? ` — ${item.decision_note}` : ''}
              </Text>
            </View>
          ) : null}
        </Card>
      )}
    />
  )
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  hint: { marginTop: 3, fontSize: 12.5, color: colors.muted },
  error: { marginTop: 4, fontSize: 13, color: colors.danger },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: colors.ink, backgroundColor: colors.surface },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  logo: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brand50 },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  body: { marginTop: 8, fontSize: 14, color: colors.ink, lineHeight: 20 },
  link: { color: colors.brand600, fontWeight: '600' },
  decision: { marginTop: 10, backgroundColor: colors.successSoft, borderRadius: radius.md, padding: 10 },
  decisionText: { color: colors.success, fontWeight: '600' },
})
