import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as WebBrowser from 'expo-web-browser'
import { useAuth } from '../auth/AuthContext'
import Icon from '../components/Icon'
import { Button, Logo } from '../components/ui'
import { WEB_URL } from '../config'
import { colors, radius, shadow } from '../theme'

const FEATURES = [
  { icon: 'shield', title: 'Sécurité garantie', text: 'Vos données sont protégées' },
  { icon: 'bolt', title: 'Accès rapide', text: 'Gérez vos demandes en un clic' },
  { icon: 'chart', title: 'Développement commercial', text: 'Boostez votre visibilité' },
]

function Field({ label, icon, error, right, ...props }) {
  return (
    <View style={{ marginTop: 16 }}>
      <View style={[styles.rowBetween, { marginBottom: 6 }]}>
        <Text style={styles.label}>{label}</Text>
        {right}
      </View>
      <View style={[styles.field, error && { borderColor: colors.danger }]}>
        <Icon name={icon} size={18} color={colors.muted} />
        <TextInput placeholderTextColor="#9a9bb0" style={styles.input} {...props} />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  )
}

/** Connexion (même maquette que le site : accueil, atouts, carte blanche avec icônes). */
export default function LoginScreen({ navigation }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  async function submit() {
    setLoading(true)
    setError(null)
    setFieldErrors({})
    try {
      await login(email.trim(), password, remember)
    } catch (loginError) {
      if (loginError.errors) setFieldErrors(loginError.errors)
      setError(loginError.message)
    } finally {
      setLoading(false)
    }
  }

  const openWeb = (path) => WebBrowser.openBrowserAsync(`${WEB_URL}${path}`)

  return (
    <LinearGradient colors={['#f6f4ff', '#efecff', '#e7e2ff']} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Logo size={38} />

          <Text style={styles.welcome}>
            Bienvenue sur{'\n'}
            <Text style={{ color: colors.brand600 }}>TijaraLink</Text>
          </Text>
          <View style={styles.swoosh} />
          <Text style={styles.intro}>
            Connectez-vous pour accéder à votre espace fournisseur, gérer vos projets et développer votre activité.
          </Text>

          <View style={{ marginTop: 18 }}>
            {FEATURES.map((feature) => (
              <View key={feature.title} style={[styles.row, { marginTop: 10 }]}>
                <View style={styles.featureIcon}>
                  <Icon name={feature.icon} size={20} color={colors.brand600} strokeWidth={2} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureText}>{feature.text}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            {navigation.canGoBack() && (
              <Pressable onPress={() => navigation.goBack()} style={styles.row} hitSlop={8}>
                <Icon name="back" size={16} color={colors.brand600} />
                <Text style={[styles.link, { marginLeft: 6 }]}>Accueil</Text>
              </Pressable>
            )}
            <Text style={styles.title}>Connexion</Text>
            <Text style={styles.subtitle}>Accédez à votre espace fournisseur, porteur de projet ou administrateur.</Text>

            <Field
              label="Adresse e-mail"
              icon="mail"
              placeholder="exemple@domaine.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              error={fieldErrors.email?.[0]}
            />
            <Field
              label="Mot de passe"
              icon="lock"
              placeholder="Entrez votre mot de passe"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              error={fieldErrors.password?.[0]}
              right={
                <Pressable onPress={() => openWeb('/mot-de-passe-oublie')} hitSlop={8}>
                  <Text style={styles.link}>Mot de passe oublié ?</Text>
                </Pressable>
              }
            />

            <View style={[styles.row, { marginTop: 14 }]}>
              <Switch value={remember} onValueChange={setRemember} trackColor={{ true: colors.brand500 }} thumbColor="#fff" />
              <Text style={{ marginLeft: 8, color: colors.ink }}>Se souvenir de moi</Text>
            </View>

            {error && !Object.keys(fieldErrors).length ? (
              <Text style={styles.alert} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <Button title="Se connecter" icon="arrow" onPress={submit} loading={loading} style={{ marginTop: 18 }} />

            <View style={[styles.row, { marginVertical: 16 }]}>
              <View style={styles.divider} />
              <Text style={{ marginHorizontal: 10, color: colors.muted }}>Ou</Text>
              <View style={styles.divider} />
            </View>

            <Button title="Accès entreprise" icon="building" variant="secondary" onPress={() => openWeb('/inscription/fournisseur')} />

            <Text style={styles.footer}>
              Pas encore de compte ?{' '}
              <Text style={styles.link} onPress={() => openWeb('/inscription')}>
                Inscrire mon entreprise
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  welcome: { marginTop: 26, fontSize: 32, fontWeight: '800', color: colors.ink, lineHeight: 38 },
  swoosh: { marginTop: 6, height: 5, width: 150, borderRadius: 3, backgroundColor: colors.brand600, transform: [{ rotate: '-2deg' }] },
  intro: { marginTop: 14, fontSize: 15, lineHeight: 22, color: colors.muted },
  featureIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.brand100 },
  featureTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  featureText: { fontSize: 13, color: colors.muted },
  card: { marginTop: 26, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 22, ...shadow },
  title: { marginTop: 14, fontSize: 30, fontWeight: '800', color: colors.ink },
  subtitle: { marginTop: 6, fontSize: 14, color: colors.muted, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink },
  field: { flexDirection: 'row', alignItems: 'center', height: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.surface },
  input: { flex: 1, marginLeft: 10, fontSize: 15, color: colors.ink, height: '100%' },
  fieldError: { marginTop: 4, color: colors.danger, fontSize: 13 },
  link: { color: colors.brand600, fontWeight: '600', fontSize: 14 },
  alert: { marginTop: 14, backgroundColor: colors.dangerSoft, color: '#a32d2d', padding: 10, borderRadius: radius.md, overflow: 'hidden' },
  divider: { flex: 1, height: 1, backgroundColor: colors.line },
  footer: { marginTop: 18, textAlign: 'center', color: colors.muted },
})
