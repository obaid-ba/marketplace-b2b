import { useEffect, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { api } from '../api/client'
import Icon from '../components/Icon'
import { Empty, ErrorBox, Loading, ProductCard } from '../components/ui'
import useApi from '../hooks/useApi'
import { colors, radius } from '../theme'
import { rows } from '../utils/format'

/** Catalogue : recherche, filtre par catégorie, grille de produits avec photos, pagination au défilement. */
export default function CatalogScreen({ navigation, route }) {
  const [query, setQuery] = useState(route.params?.q ?? '')
  const [submitted, setSubmitted] = useState(route.params?.q ?? '')
  const [category, setCategory] = useState(route.params?.category ?? '')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const categories = useApi(() => api('/categories'))

  // Paramètres reçus depuis l'accueil (recherche ou catégorie).
  useEffect(() => {
    if (route.params?.q !== undefined) {
      setQuery(route.params.q)
      setSubmitted(route.params.q)
    }
    if (route.params?.category !== undefined) setCategory(route.params.category)
  }, [route.params])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api('/products', { params: { q: submitted, category, page, per_page: 12, supplier_id: route.params?.supplier } })
      .then((data) => {
        if (!active) return
        setItems((current) => (page === 1 ? rows(data) : [...current, ...rows(data)]))
        setMeta(data.meta ?? null)
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [submitted, category, page, route.params?.supplier])

  const chooseCategory = (id) => {
    setPage(1)
    setCategory(id)
  }

  const runSearch = () => {
    setPage(1)
    setSubmitted(query.trim())
  }

  const roots = (Array.isArray(categories.data) ? categories.data : rows(categories.data)).filter((item) => !item.parent_id)
  const hasMore = meta && meta.current_page < meta.last_page

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={styles.header}>
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            returnKeyType="search"
            placeholder="Rechercher un produit, un service…"
            placeholderTextColor="#9a9bb0"
            style={styles.searchInput}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {[{ id: '', name: 'Tous' }, ...roots].map((chip) => {
            const active = String(chip.id) === String(category)
            return (
              <Pressable key={chip.id || 'all'} onPress={() => chooseCategory(chip.id)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && { color: '#fff' }]}>{chip.name}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
        {meta?.total !== undefined && <Text style={styles.count}>{meta.total} résultat{meta.total > 1 ? 's' : ''}</Text>}
      </View>

      {error && !items.length ? (
        <View style={{ padding: 16 }}>
          <ErrorBox message={error} onRetry={() => setPage(1)} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              style={{ width: '48.5%', marginBottom: 12 }}
              onPress={() => navigation.navigate('Produit', { id: item.id, title: item.title })}
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => hasMore && !loading && setPage((current) => current + 1)}
          ListEmptyComponent={loading ? null : <Empty title="Aucun produit trouvé" text="Essayez un autre mot-clé ou une autre catégorie." />}
          ListFooterComponent={loading ? <Loading /> : null}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { padding: 16, paddingBottom: 8, backgroundColor: colors.page },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: colors.ink, height: '100%' },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  chipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  count: { marginTop: 10, fontSize: 13, color: colors.muted },
})
