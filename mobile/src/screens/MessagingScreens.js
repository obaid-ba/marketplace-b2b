import { useEffect, useRef, useState } from 'react'
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { api, mediaUrl } from '../api/client'
import Icon from '../components/Icon'
import { Card, ErrorBox, Loading } from '../components/ui'
import useApi from '../hooks/useApi'
import { useUnread } from '../sync/UnreadContext'
import { colors, radius } from '../theme'
import { timeAgo } from '../utils/format'
import { ApiList } from './ListScreens'

const POLL_MS = 10000

function Avatar({ party }) {
  const initials = (party?.name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return party?.avatar_url ? (
    <Image source={{ uri: mediaUrl(party.avatar_url) }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, styles.center]}>
      <Text style={styles.initials}>{initials}</Text>
    </View>
  )
}

/** Liste des conversations (mêmes que la messagerie du site), rafraîchie toutes les 10 secondes. */
export function ConversationsScreen({ navigation }) {
  return (
    <ApiList
      fetcher={() => api('/conversations', { params: { per_page: 50 } })}
      pollMs={POLL_MS}
      emptyTitle="Aucune conversation"
      emptyText="Contactez un fournisseur depuis sa fiche sur le site pour démarrer un échange."
      renderItem={({ item }) => (
        <Pressable onPress={() => navigation.navigate('Conversation', { id: item.id, title: item.party?.name })}>
          <Card style={item.unread_count > 0 && { borderColor: colors.brand100, backgroundColor: '#fbfaff' }}>
            <View style={styles.row}>
              <Avatar party={item.party} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.party?.name}
                  </Text>
                  {item.last_message ? <Text style={styles.time}>{timeAgo(item.last_message.sent_at)}</Text> : null}
                </View>
                {item.context?.label ? (
                  <Text style={styles.context} numberOfLines={1}>
                    {item.context.label}
                  </Text>
                ) : null}
                <View style={styles.rowBetween}>
                  <Text style={[styles.preview, item.unread_count > 0 && { color: colors.ink, fontWeight: '600' }]} numberOfLines={1}>
                    {item.last_message?.is_mine ? 'Vous : ' : ''}
                    {item.last_message?.body || (item.last_message?.attachment ? 'Pièce jointe' : '')}
                  </Text>
                  {item.unread_count > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread_count}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </Card>
        </Pressable>
      )}
    />
  )
}

/** Une conversation : messages, envoi, accusé de lecture ; nouveaux messages toutes les 10 secondes. */
export function ConversationScreen({ route }) {
  const { id } = route.params
  const unread = useUnread()
  const list = useRef(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const { data, setData, loading, error, reload } = useApi(() => api(`/conversations/${id}/messages`, { params: { per_page: 100 } }), [id], {
    pollMs: POLL_MS,
  })

  const messages = data?.data ?? []
  const lastId = messages.at(-1)?.id

  // Marque la conversation comme lue (ici et sur le site) dès qu'un nouveau message est affiché.
  useEffect(() => {
    if (!lastId) return
    api(`/conversations/${id}/read`, { method: 'POST' })
      .then(() => unread.refresh())
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lastId])

  async function send() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setSendError(null)
    try {
      const sent = await api(`/conversations/${id}/messages`, { method: 'POST', body: { body } })
      const message = sent?.data ?? sent?.message ?? sent
      setDraft('')
      if (message?.id) setData((current) => ({ ...(current ?? {}), data: [...(current?.data ?? []), message] }))
      else reload()
    } catch (requestError) {
      setSendError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  if (loading && !data) return <Loading />
  if (error && !data) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorBox message={error} onRetry={reload} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.is_mine ? styles.mine : styles.theirs]}>
            {item.body ? <Text style={[styles.text, item.is_mine && { color: '#fff' }]}>{item.body}</Text> : null}
            {item.attachment ? (
              <Text style={[styles.attachment, item.is_mine && { color: '#e7e4ff' }]}>📎 {item.attachment.name ?? 'Pièce jointe'} (à ouvrir sur le site)</Text>
            ) : null}
            <Text style={[styles.time, { marginTop: 4 }, item.is_mine && { color: '#d9d4ff' }]}>{timeAgo(item.sent_at)}</Text>
          </View>
        )}
      />
      {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Écrivez votre message…"
          placeholderTextColor="#9a9bb0"
          style={styles.input}
          multiline
          maxLength={2000}
        />
        <Pressable onPress={send} disabled={sending} style={[styles.send, sending && { opacity: 0.6 }]} accessibilityLabel="Envoyer">
          <Icon name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand50 },
  initials: { color: colors.brand600, fontWeight: '800' },
  name: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink, marginRight: 8 },
  context: { marginTop: 2, fontSize: 12, color: colors.brand600 },
  preview: { flex: 1, marginTop: 3, fontSize: 13, color: colors.muted, marginRight: 8 },
  time: { fontSize: 11, color: colors.muted },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubble: { maxWidth: '82%', borderRadius: radius.lg, padding: 12, marginBottom: 10 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.brand600, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
  text: { fontSize: 15, lineHeight: 21, color: colors.ink },
  attachment: { marginTop: 4, fontSize: 13, color: colors.brand600 },
  error: { color: colors.danger, paddingHorizontal: 16, paddingBottom: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink },
  send: { marginLeft: 10, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand600, alignItems: 'center', justifyContent: 'center' },
})
