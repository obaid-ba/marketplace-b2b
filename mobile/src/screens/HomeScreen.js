import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import Icon from '../components/Icon'
import { Card, ErrorBox, Loading, Logo, ProductCard, SectionTitle } from '../components/ui'
import useApi from '../hooks/useApi'
import { colors, radius, shadow } from '../theme'
import { formatNumber, plural, rows } from '../utils/format'

const STEPS = [
  { icon: 'file', title: 'Publiez votre demande', text: 'Décrivez votre besoin, votre budget et votre délai.' },
  { icon: 'chart', title: 'Comparez les devis', text: 'Prix, délais et conditions, puis échangez par messagerie.' },
  { icon: 'truck', title: 'Commandez et suivez', text: 'Acceptez le meilleur devis et suivez la livraison.' },
]

function categoryIcon(name = '') {
  const value = name.toLowerCase()
  if (value.includes('emballage')) return 'box'
  if (value.includes('logistique') || value.includes('transport')) return 'truck'
  if (value.includes('informatique')) return 'grid'
  if (value.includes('service')) return 'users'
  if (value.includes('bureau')) return 'file'
  if (value.includes('équipement')) return 'settings'
  if (value.includes('btp')) return 'building'
  return 'star'
}

/** Accueil : recherche, chiffres clés, catégories, catalogue avec photos, étapes, bandeau fournisseurs. */
export default function HomeScreen({ navigation }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const home = useApi(() => api('/home'))
  const latest = useApi(() => api('/products', { params: { per_page: 8 } }))

  const stats = home.data?.stats
  const categories = home.data?.categories ?? []
  const products = rows(latest.data)
  const featured = home.data?.featured_products ?? []

  const search = () => navigation.navigate('Catalogue', { q: query.trim() })

  return (
    <ScrollView
      style={{ backgroundColor: colors.lavender }}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={home.refreshing || latest.refreshing}
          onRefresh={() => {
            home.refresh()
            latest.refresh()
          }}
        />
      }
    >
      <View style={[styles.rowBetween, { marginBottom: 16 }]}>
        <Logo size={32} />
        {!user && (
          <Pressable onPress={() => navigation.navigate('Connexion')} style={styles.loginPill}>
            <Text style={styles.loginPillText}>Connexion</Text>
          </Pressable>
        )}
      </View>

      {/* Hero */}
      <LinearGradient colors={['#f6f4ff', '#ece9fe', '#e3defc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.pill}>
          <Icon name="pin" size={13} color={colors.brand600} />
          <Text style={styles.pillText}>Plateforme B2B - Tunisie</Text>
        </View>
        <Text style={styles.heroTitle}>
          Trouvez les bons fournisseurs, sans <Text style={styles.underline}>courir</Text> après les devis
        </Text>
        <Text style={styles.heroText}>
          Publiez votre besoin, comparez les devis reçus et commandez en toute confiance auprès de fournisseurs validés.
        </Text>

        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
            placeholder="Emballages, pièces, maintenance…"
            placeholderTextColor="#9a9bb0"
            style={styles.searchInput}
          />
          <Pressable onPress={search} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>Rechercher</Text>
          </Pressable>
        </View>

        <View style={[styles.rowBetween, { marginTop: 18 }]}>
          {[
            ['shield', stats?.suppliers, 'fournisseurs validés'],
            ['bolt', stats?.products, 'produits et services'],
            ['pin', stats?.regions, 'gouvernorats'],
          ].map(([icon, value, label]) => (
            <View key={label} style={styles.stat}>
              <View style={styles.statIcon}>
                <Icon name={icon} size={16} color={colors.brand600} />
              </View>
              <Text style={styles.statValue}>{value !== undefined ? formatNumber(value) : '—'}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {home.error && !home.data ? <ErrorBox message={home.error} onRetry={home.reload} /> : null}

      {/* Catégories */}
      <Card style={styles.section}>
        <SectionTitle title="Parcourir par catégorie" action="Voir tout" onAction={() => navigation.navigate('Catalogue')} />
        {home.loading ? (
          <Loading />
        ) : (
          <View style={styles.grid}>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => navigation.navigate('Catalogue', { category: category.id, categoryName: category.name })}
                style={({ pressed }) => [styles.category, pressed && { opacity: 0.8 }]}
              >
                <View style={styles.categoryIcon}>
                  <Icon name={categoryIcon(category.name)} size={20} color={colors.brand600} />
                </View>
                <Text style={styles.categoryName} numberOfLines={2}>
                  {category.name}
                </Text>
                <Text style={styles.categoryCount}>{plural(category.products_count ?? 0, 'produit')}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      {/* Catalogue des produits */}
      <Card style={styles.section}>
        <SectionTitle title="Catalogue des produits" action="Voir tout" onAction={() => navigation.navigate('Catalogue')} />
        {latest.loading ? (
          <Loading />
        ) : latest.error ? (
          <ErrorBox message={latest.error} onRetry={latest.reload} />
        ) : (
          <View style={styles.grid}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                style={styles.half}
                onPress={() => navigation.navigate('Produit', { id: product.id, title: product.title })}
              />
            ))}
          </View>
        )}
      </Card>

      {/* Produits mis en avant */}
      {featured.length > 0 && (
        <Card style={styles.section}>
          <SectionTitle title="Produits mis en avant" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {featured.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                style={{ width: 200, marginRight: 12 }}
                onPress={() => navigation.navigate('Produit', { id: product.id, title: product.title })}
              />
            ))}
          </ScrollView>
        </Card>
      )}

      {/* Comment ça marche */}
      <Card style={styles.section}>
        <SectionTitle title="Comment ça marche" />
        {STEPS.map((step, index) => (
          <View key={step.title} style={[styles.step, index > 0 && { marginTop: 10 }]}>
            <View style={styles.stepIcon}>
              <Icon name={step.icon} size={24} color={colors.brand600} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.row}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Bandeau fournisseurs */}
      <LinearGradient colors={['#3b2bb5', '#4a3bc4', '#6d5fe0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.section, styles.supplierBanner]}>
        <Text style={styles.supplierTitle}>Vous êtes fournisseur ?</Text>
        <Text style={styles.supplierText}>Référencez vos produits et répondez aux appels d'offres des porteurs de projet.</Text>
        {!user && (
          <Pressable onPress={() => navigation.navigate('Connexion')} style={styles.supplierButton}>
            <Text style={styles.supplierButtonText}>Devenir fournisseur →</Text>
          </Pressable>
        )}
      </LinearGradient>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingTop: 56, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loginPill: { backgroundColor: colors.brand600, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  loginPillText: { color: '#fff', fontWeight: '700' },
  hero: { borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: '#ffffff', ...shadow },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.brand100 },
  pillText: { marginLeft: 5, color: colors.brand600, fontSize: 12, fontWeight: '700' },
  heroTitle: { marginTop: 14, fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.ink },
  underline: { textDecorationLine: 'underline', textDecorationColor: colors.brand600 },
  heroText: { marginTop: 10, fontSize: 14, lineHeight: 21, color: colors.muted },
  search: { marginTop: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingLeft: 12, padding: 6 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: colors.ink, height: 40 },
  searchButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  searchButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  stat: { flex: 1, alignItems: 'center' },
  statIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  statValue: { marginTop: 4, fontSize: 18, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  section: { marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  half: { width: '48.5%', marginBottom: 12 },
  category: { width: '48.5%', marginBottom: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 12, backgroundColor: colors.surface },
  categoryIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  categoryName: { marginTop: 8, fontSize: 13, fontWeight: '700', color: colors.ink },
  categoryCount: { marginTop: 2, fontSize: 12, color: colors.muted },
  step: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 12 },
  stepIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand600, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  stepNumberText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stepTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  stepText: { marginTop: 4, fontSize: 13, color: colors.muted, lineHeight: 18 },
  supplierBanner: { borderRadius: radius.xl, padding: 20 },
  supplierTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  supplierText: { marginTop: 6, fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  supplierButton: { marginTop: 14, alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  supplierButtonText: { color: colors.ink, fontWeight: '700' },
})
