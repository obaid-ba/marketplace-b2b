import { useState } from 'react'
import { Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { api, mediaUrl } from '../api/client'
import Icon from '../components/Icon'
import { Badge, Button, Card, ErrorBox, Loading } from '../components/ui'
import { WEB_URL } from '../config'
import useApi from '../hooks/useApi'
import { colors, radius } from '../theme'
import { formatPrice } from '../utils/format'

const WIDTH = Dimensions.get('window').width

/** Fiche produit : photos, prix, fournisseur, description et derniers avis. */
export default function ProductScreen({ route }) {
  const { id } = route.params
  const { data: product, loading, error, reload } = useApi(() => api(`/products/${id}`), [id])
  const [index, setIndex] = useState(0)

  if (loading) return <Loading />
  if (error) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorBox message={error} onRetry={reload} />
      </View>
    )
  }

  const images = product.images?.length ? product.images : [{ id: 0, url: null }]
  const supplier = product.supplier ?? {}

  return (
    <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={{ paddingBottom: 32 }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / WIDTH))}
      >
        {images.map((image) =>
          image.url ? (
            <Image key={image.id} source={{ uri: mediaUrl(image.url) }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View key={image.id} style={[styles.photo, styles.placeholder]}>
              <Icon name="box" size={48} color={colors.brand500} />
            </View>
          ),
        )}
      </ScrollView>
      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((image, dot) => (
            <View key={image.id} style={[styles.dot, dot === index && styles.dotActive]} />
          ))}
        </View>
      )}

      <View style={{ padding: 16 }}>
        <View style={styles.row}>
          <Badge label={product.type === 'service' ? 'Service' : 'Produit'} />
          {product.category?.name ? <Text style={styles.category}>{product.category.name}</Text> : null}
        </View>
        <Text style={styles.title}>{product.title}</Text>
        <Text style={styles.price}>{formatPrice(product.price, product.unit)}</Text>
        <Text style={styles.meta}>
          {product.in_stock === false ? 'Rupture de stock' : 'Disponible'}
          {product.availability_days ? ` · sous ${product.availability_days} jour${product.availability_days > 1 ? 's' : ''}` : ''}
        </Text>

        <Card style={{ marginTop: 16 }}>
          <View style={styles.row}>
            {supplier.logo_url ? (
              <Image source={{ uri: mediaUrl(supplier.logo_url) }} style={styles.logo} />
            ) : (
              <View style={[styles.logo, styles.placeholder]}>
                <Icon name="building" size={20} color={colors.brand600} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.supplier}>{supplier.company_name}</Text>
              <Text style={styles.meta}>
                {supplier.region}
                {supplier.rating_avg ? ` · ★ ${Number(supplier.rating_avg).toFixed(1)} (${supplier.reviews_count ?? 0} avis)` : ''}
              </Text>
            </View>
          </View>
        </Card>

        {product.description ? (
          <Card style={{ marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{product.description}</Text>
          </Card>
        ) : null}

        {product.latest_reviews?.length ? (
          <Card style={{ marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Avis sur le fournisseur</Text>
            {product.latest_reviews.map((review) => (
              <View key={review.id} style={styles.review}>
                <Text style={styles.reviewAuthor}>
                  {review.author} · <Text style={{ color: '#f5a524' }}>{'★'.repeat(review.rating)}</Text>
                </Text>
                {review.comment ? <Text style={styles.description}>« {review.comment} »</Text> : null}
              </View>
            ))}
          </Card>
        ) : null}

        <Button
          title="Demander un devis sur le site"
          icon="arrow"
          style={{ marginTop: 16 }}
          onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/produits/${product.id}`)}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  photo: { width: WIDTH, height: WIDTH * 0.75 },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand50 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand100, marginHorizontal: 3 },
  dotActive: { backgroundColor: colors.brand600, width: 18 },
  category: { marginLeft: 8, fontSize: 13, color: colors.muted },
  title: { marginTop: 10, fontSize: 24, fontWeight: '800', color: colors.ink },
  price: { marginTop: 6, fontSize: 22, fontWeight: '800', color: colors.brand600 },
  meta: { marginTop: 4, fontSize: 13, color: colors.muted },
  logo: { width: 48, height: 48, borderRadius: radius.md },
  supplier: { fontSize: 16, fontWeight: '700', color: colors.ink },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  description: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  review: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  reviewAuthor: { fontSize: 14, fontWeight: '700', color: colors.ink },
})
