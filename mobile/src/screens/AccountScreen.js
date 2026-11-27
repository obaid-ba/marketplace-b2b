import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useAuth } from '../auth/AuthContext'
import Icon from '../components/Icon'
import { Button, Card } from '../components/ui'
import { WEB_URL } from '../config'
import { colors } from '../theme'

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

/** Compte : identité, raccourcis vers le site, assistant IA, déconnexion. */
export default function AccountScreen({ navigation }) {
  const { user, logout } = useAuth()
  const name = user?.supplier_company_name || user?.name

  const links = [
    { icon: 'home', label: 'Accueil de la plateforme', onPress: () => navigation.navigate('Accueil') },
    { icon: 'grid', label: 'Catalogue des produits', onPress: () => navigation.navigate('Catalogue') },
    user?.role !== 'admin' && { icon: 'sparkles', label: 'Assistant IA', onPress: () => navigation.navigate('Assistant') },
    { icon: 'settings', label: 'Paramètres du compte (site)', onPress: () => WebBrowser.openBrowserAsync(`${WEB_URL}/parametres`) },
    { icon: 'bell', label: 'Préférences de notification (site)', onPress: () => WebBrowser.openBrowserAsync(`${WEB_URL}/parametres/notifications`) },
  ].filter(Boolean)

  return (
    <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(name)}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.detail}>{user?.email}</Text>
        <Text style={[styles.role]}>{user?.role_label}</Text>
      </Card>

      <Card style={{ marginTop: 14, paddingVertical: 4 }}>
        {links.map((link, index) => (
          <Pressable key={link.label} onPress={link.onPress} style={[styles.link, index < links.length - 1 && styles.divider]}>
            <Icon name={link.icon} size={20} color={colors.brand600} />
            <Text style={styles.linkText}>{link.label}</Text>
            <Icon name="arrow" size={16} color={colors.muted} />
          </Pressable>
        ))}
      </Card>

      <Button title="Se déconnecter" icon="logout" variant="secondary" onPress={logout} style={{ marginTop: 18, borderColor: '#f7c1c1' }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800', color: colors.brand600 },
  name: { marginTop: 12, fontSize: 20, fontWeight: '800', color: colors.ink },
  detail: { marginTop: 4, fontSize: 14, color: colors.muted },
  role: { marginTop: 10, color: colors.brand600, fontWeight: '700', backgroundColor: colors.brand50, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  link: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  linkText: { flex: 1, marginLeft: 12, fontSize: 15, color: colors.ink, fontWeight: '600' },
})
