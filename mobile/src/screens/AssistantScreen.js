import { useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { api } from '../api/client'
import Icon from '../components/Icon'
import { colors, radius } from '../theme'

/** Identifiant de conversation (UUID v4) exigé par l'API du chatbot. */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

/** Assistant IA (chatbot d'aide du site) : réponses à partir du guide de la plateforme. */
export default function AssistantScreen() {
  const conversation = useRef(uuid())
  const list = useRef(null)
  const [messages, setMessages] = useState([
    { id: 'hello', from: 'bot', text: 'Bonjour ! Je suis l’assistant TijaraLink. Posez-moi une question sur la plateforme.' },
  ])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    const text = draft.trim()
    if (text.length < 2 || sending) return
    const history = messages.filter((message) => message.id !== 'hello').map(({ from, text: body }) => ({ from, text: body }))
    setMessages((current) => [...current, { id: `u${Date.now()}`, from: 'user', text }])
    setDraft('')
    setSending(true)
    try {
      const reply = await api('/chatbot/messages', {
        method: 'POST',
        body: { conversation_id: conversation.current, message: text, history, page: 'application mobile' },
      })
      setMessages((current) => [...current, { id: `b${Date.now()}`, from: 'bot', text: reply.answer, simulated: reply.simulated }])
    } catch (error) {
      setMessages((current) => [...current, { id: `e${Date.now()}`, from: 'bot', text: error.message, error: true }])
    } finally {
      setSending(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.from === 'user' ? styles.user : styles.bot, item.error && styles.error]}>
            <Text style={[styles.text, item.from === 'user' && { color: '#fff' }]}>{item.text}</Text>
            {item.simulated ? <Text style={styles.note}>Mode simulé, sans IA</Text> : null}
          </View>
        )}
        ListFooterComponent={sending ? <Text style={styles.typing}>L’assistant écrit…</Text> : null}
      />
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Écrivez votre question…"
          placeholderTextColor="#9a9bb0"
          style={styles.input}
          multiline
          maxLength={1000}
        />
        <Pressable onPress={send} disabled={sending} style={[styles.send, sending && { opacity: 0.6 }]} accessibilityLabel="Envoyer">
          <Icon name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', borderRadius: radius.lg, padding: 12, marginBottom: 10 },
  user: { alignSelf: 'flex-end', backgroundColor: colors.brand600, borderBottomRightRadius: 4 },
  bot: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
  error: { backgroundColor: colors.dangerSoft, borderColor: '#f7c1c1' },
  text: { fontSize: 15, lineHeight: 21, color: colors.ink },
  note: { marginTop: 6, fontSize: 11, color: colors.muted },
  typing: { color: colors.muted, fontStyle: 'italic' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink },
  send: { marginLeft: 10, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand600, alignItems: 'center', justifyContent: 'center' },
})
