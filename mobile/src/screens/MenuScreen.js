import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import Icon from '../components/Icon'
import { Logo } from '../components/ui'
import { MENUS } from '../navigation/menus'
import { useUnread } from '../sync/UnreadContext'
import { colors, radius, shadow } from '../theme'

/** Menu complet de l'espace : mêmes rubriques et entrées que la barre latérale du site. */
export default function MenuScreen({ navigation }) {
  const { user, logout } = useAuth()
  const unread = useUnread()
  const groups = MENUS[user?.role] ?? []

  return (
    <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={styles.header}>
        <Logo size={32} />
        <Text style={styles.space}>{user?.role_label}</Text>
      </View>

      {groups.map((group) => (
        <View key={group.group} style={{ marginTop: 18 }}>
          <Text style={styles.group}>{group.group}</Text>
          <View style={styles.card}>
            {group.items.map((item, index) => {
              const count = item.badge === 'messages' ? unread.messages : item.screen === 'Notifications' ? unread.notifications : 0
              return (
                <Pressable
                  key={item.label}
                  onPress={() => navigation.navigate(item.screen)}
                  style={({ pressed }) => [styles.item, index < group.items.length - 1 && styles.divider, pressed && { backgroundColor: colors.brand50 }]}
                >
                  <View style={styles.icon}>
                    <Icon name={item.icon} size={19} color={colors.brand600} />
                  </View>
                  <Text style={styles.label}>{item.label}</Text>
                  {count > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                    </View>
                  ) : (
                    <Icon name="arrow" size={16} color={colors.muted} />
                  )}
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}

      <Pressable onPress={logout} style={[styles.card, styles.item, { marginTop: 18 }]}>
        <View style={[styles.icon, { backgroundColor: colors.dangerSoft }]}>
          <Icon name="logout" size={19} color={colors.danger} />
        </View>
        <Text style={[styles.label, { color: colors.danger }]}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  space: { color: colors.brand600, fontWeight: '700', backgroundColor: colors.brand50, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12 },
  group: { fontSize: 13, color: colors.muted, marginBottom: 6, marginLeft: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadow },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600', color: colors.ink },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.brand600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
})
