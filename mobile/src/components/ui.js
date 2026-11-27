import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Path } from 'react-native-svg'
import { mediaUrl } from '../api/client'
import { colors, radius, shadow, tones } from '../theme'
import { formatAmount, formatPrice } from '../utils/format'
import Icon, { LogoMark } from './Icon'

export function Logo({ size = 34 }) {
  return (
    <View style={styles.row}>
      <LogoMark size={size} />
      <Text style={[styles.logoText, { fontSize: size * 0.55 }]}>
        Tijara<Text style={{ color: colors.brand600 }}>Link</Text>
      </Text>
    </View>
  )
}

/** Carte blanche arrondie (sections du tableau de bord, listes). */
export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function SectionTitle({ icon, title, action, onAction }) {
  return (
    <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
      <View style={styles.row}>
        {icon && <Icon name={icon} color={colors.brand600} size={20} />}
        <Text style={[styles.sectionTitle, icon && { marginLeft: 8 }]}>{title}</Text>
      </View>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.link}>{action} →</Text>
        </Pressable>
      )}
    </View>
  )
}

export function Button({ title, onPress, icon, variant = 'primary', loading, disabled, style }) {
  const primary = variant === 'primary'
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || disabled || loading) && { opacity: 0.75 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? '#fff' : colors.brand600} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={primary ? '#fff' : colors.brand600} />}
          <Text style={[styles.buttonText, { color: primary ? '#fff' : colors.ink }, icon && { marginLeft: 8 }]}>{title}</Text>
        </>
      )}
    </Pressable>
  )
}

export function Badge({ label, tone = 'violet' }) {
  const palette = {
    violet: [colors.brand50, colors.brand600],
    green: [colors.successSoft, colors.success],
    orange: [colors.accentSoft, colors.accent],
    blue: [colors.infoSoft, colors.info],
    red: [colors.dangerSoft, colors.danger],
  }[tone]
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      <Text style={[styles.badgeText, { color: palette[1] }]}>{label}</Text>
    </View>
  )
}

/** Couleur d'un statut de commande ou de demande. */
export function statusTone(status = '') {
  const value = status.toLowerCase()
  if (/(clôtur|livr|accept|valid|publi|actif)/.test(value)) return 'green'
  if (/(annul|refus|retir|rejet)/.test(value)) return 'red'
  if (/(expédi|cours|prépar)/.test(value)) return 'blue'
  if (/(attente|envoy|négoc|ouvert)/.test(value)) return 'orange'
  return 'violet'
}

/** Bannière d'accueil des tableaux de bord : dégradé lavande. */
export function WelcomeBanner({ title, subtitle }) {
  return (
    <LinearGradient colors={['#f1efff', '#ece9fe', '#ddd8fc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
      <Text style={styles.bannerTitle}>{title}</Text>
      {subtitle ? <Text style={styles.bannerSubtitle}>{subtitle}</Text> : null}
      <View style={styles.bannerBar} />
    </LinearGradient>
  )
}

/** Mini-courbe sous une valeur. */
function Sparkline({ values, color }) {
  if (!values || values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const points = values.map((value, index) => [(index / (values.length - 1)) * 100, 26 - ((value - min) / range) * 22])
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <Svg width="100%" height={30} viewBox="0 0 100 30" preserveAspectRatio="none" style={{ marginTop: 10 }}>
      <Path d={`${line} L100 30 L0 30 Z`} fill={color} opacity={0.12} />
      <Path d={line} stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  )
}

/** Carte d'indicateur colorée (icône dans un rond, libellé, valeur, précision, mini-courbe). */
export function KpiCard({ label, value, hint, icon, tone = 'violet', trend }) {
  const palette = tones[tone] ?? tones.violet
  return (
    <View style={[styles.card, styles.kpi]}>
      <View style={styles.row}>
        <View style={[styles.kpiCircle, { backgroundColor: palette.circle }]}>
          <Icon name={icon} size={22} color={palette.icon} strokeWidth={2.1} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.kpiLabel}>{label}</Text>
          <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
        </View>
      </View>
      {hint ? <Text style={[styles.kpiHint, { color: palette.text }]}>{hint}</Text> : null}
      <Sparkline values={trend} color={palette.icon} />
    </View>
  )
}

/** Carte produit avec photo, fournisseur, note et prix. */
export function ProductCard({ product, onPress, style }) {
  const supplier = product.supplier ?? {}
  const image = mediaUrl(product.main_image_url ?? product.images?.[0]?.url)
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, styles.product, pressed && { opacity: 0.85 }, style]}>
      <View style={styles.productImageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={[styles.productImage, styles.center, { backgroundColor: colors.brand50 }]}>
            <Icon name="box" size={28} color={colors.brand500} />
          </View>
        )}
        {product.featured ? (
          <View style={styles.featured}>
            <Text style={styles.featuredText}>★ Mis en avant</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.productTitle} numberOfLines={1}>
        {product.title}
      </Text>
      <Text style={styles.productSupplier} numberOfLines={1}>
        {[supplier.company_name, supplier.region].filter(Boolean).join(' - ')}
        {supplier.rating_avg ? `  ★ ${Number(supplier.rating_avg).toFixed(1)}` : ''}
      </Text>
      <Text style={styles.productPrice}>{formatPrice(product.price, product.unit)}</Text>
    </Pressable>
  )
}

export function Loading() {
  return (
    <View style={[styles.center, { padding: 40 }]}>
      <ActivityIndicator size="large" color={colors.brand600} />
    </View>
  )
}

export function ErrorBox({ message, onRetry }) {
  return (
    <View style={styles.error}>
      <Text style={styles.errorTitle}>Le contenu n'a pas pu être chargé.</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && <Button title="Réessayer" variant="secondary" onPress={onRetry} style={{ marginTop: 12, alignSelf: 'flex-start' }} />}
    </View>
  )
}

export function Empty({ title, text }) {
  return (
    <View style={[styles.center, { paddingVertical: 24 }]}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
    </View>
  )
}

/** Ligne de liste : titre, détail, badge à droite, montant facultatif. */
export function ListRow({ title, detail, badge, amount, onPress, last }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.listRow, !last && styles.listDivider]}>
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={styles.listTitle} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text style={styles.listDetail} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {badge}
        {amount !== undefined && amount !== null ? <Text style={styles.listAmount}>{formatAmount(amount)}</Text> : null}
      </View>
    </Pressable>
  )
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  logoText: { marginLeft: 8, fontWeight: '700', color: colors.ink },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, ...shadow },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  link: { color: colors.brand600, fontWeight: '600', fontSize: 14 },
  button: { height: 48, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonPrimary: { backgroundColor: colors.brand600 },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand100 },
  buttonText: { fontSize: 15, fontWeight: '600' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  banner: { borderRadius: radius.lg, padding: 20 },
  bannerTitle: { fontSize: 24, fontWeight: '700', color: colors.ink },
  bannerSubtitle: { marginTop: 6, fontSize: 14, color: colors.muted, lineHeight: 20 },
  bannerBar: { marginTop: 14, height: 4, width: 44, borderRadius: 2, backgroundColor: colors.brand600 },
  kpi: { flex: 1 },
  kpiCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  kpiLabel: { fontSize: 13, fontWeight: '600', color: colors.ink },
  kpiValue: { fontSize: 20, fontWeight: '700', color: colors.ink, marginTop: 2 },
  kpiHint: { fontSize: 12, marginTop: 8 },
  product: { padding: 10 },
  productImageWrap: { borderRadius: radius.md, overflow: 'hidden' },
  productImage: { width: '100%', aspectRatio: 4 / 3 },
  featured: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  featuredText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  productTitle: { marginTop: 10, fontSize: 14, fontWeight: '700', color: colors.ink },
  productSupplier: { marginTop: 3, fontSize: 12, color: colors.muted },
  productPrice: { marginTop: 6, fontSize: 15, fontWeight: '700', color: colors.brand600 },
  error: { backgroundColor: colors.dangerSoft, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: '#f7c1c1' },
  errorTitle: { fontWeight: '700', color: '#a32d2d' },
  errorText: { marginTop: 4, color: '#a32d2d' },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  emptyText: { marginTop: 4, fontSize: 13, color: colors.muted, textAlign: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  listDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  listTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  listDetail: { marginTop: 3, fontSize: 12, color: colors.muted },
  listAmount: { marginTop: 4, fontSize: 14, fontWeight: '700', color: colors.ink },
})
