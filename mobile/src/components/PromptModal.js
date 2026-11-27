import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, radius } from '../theme'
import { Button } from './ui'

/**
 * Fenêtre de saisie (motif d'un refus, réponse à un avis…). onSubmit(texte) peut lever une erreur :
 * son message est affiché et la fenêtre reste ouverte.
 */
export default function PromptModal({ visible, title, message, placeholder, confirmLabel = 'Valider', minLength = 0, onSubmit, onClose }) {
  const [text, setText] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      setText('')
      setError(null)
    }
  }, [visible])

  async function confirm() {
    if (text.trim().length < minLength) {
      setError(`Au moins ${minLength} caractères.`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onSubmit(text.trim())
      onClose()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor="#9a9bb0"
            multiline
            style={styles.input}
            autoFocus
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button title="Annuler" variant="secondary" onPress={onClose} style={{ flex: 1, marginRight: 8 }} />
            <Button title={confirmLabel} onPress={confirm} loading={loading} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,20,43,0.45)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  message: { marginTop: 6, fontSize: 14, color: colors.muted },
  input: { marginTop: 14, minHeight: 100, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.ink, textAlignVertical: 'top' },
  error: { marginTop: 8, color: colors.danger },
  actions: { flexDirection: 'row', marginTop: 16 },
})
