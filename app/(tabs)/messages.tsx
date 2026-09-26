import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AuroraBackground from '@/components/AuroraBackground';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { AppMessage, Announcement } from '@/data/mockData';
import type { SupabaseContact } from '@/lib/supabase';

export default function MessagesScreen() {
  const { messages, unreadCount, markRead, sendMessage, loadContacts, announcements } = useApp();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [selected, setSelected] = useState<AppMessage | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [contacts, setContacts] = useState<SupabaseContact[]>([]);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(true);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const filtered = messages.filter(m => (tab === 'inbox') === m.isInbox);

  const openMessage = (m: AppMessage) => {
    setSelected(m);
    if (m.isInbox && !m.isRead) markRead(m.id);
  };

  const openCompose = async () => {
    setRecipientId(null);
    setComposing(true);
    setContactsLoading(true);
    const list = await loadContacts();
    setContacts(list);
    if (list.length === 1) setRecipientId(list[0].id);
    setContactsLoading(false);
  };

  const doSend = async () => {
    if (!recipientId) {
      Alert.alert('Choose a recipient', 'Select who you are writing to.');
      return;
    }
    if (!composeSubject.trim() || !composeBody.trim()) {
      Alert.alert('Missing details', 'Please enter a subject and a message.');
      return;
    }
    setSending(true);
    const result = await sendMessage({
      recipientId,
      subject: composeSubject.trim(),
      body: composeBody.trim(),
    });
    setSending(false);

    if (!result.ok) {
      Alert.alert('Message not sent', result.error ?? 'Please try again.');
      return;
    }

    setComposing(false);
    setComposeSubject('');
    setComposeBody('');
    setRecipientId(null);
    setTab('sent');
  };

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.foreground }]}>Messages</Text>
            {unreadCount > 0 && (
              <Text style={[styles.unreadLine, { color: c.mutedForeground }]}>
                {unreadCount} unread message{unreadCount === 1 ? '' : 's'}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.composeBtn} onPress={openCompose} activeOpacity={0.8}>
            <LinearGradient colors={[c.primary, c.secondary]} style={styles.composeBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="create-outline" size={18} color="#FFF" />
              <Text style={styles.composeBtnText}>Compose</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Announcements come first: the school's messages to this parent. */}
        {announcements.length > 0 && (
          <View style={styles.annSection}>
            <TouchableOpacity
              style={styles.annSectionHeader}
              onPress={() => setShowAnnouncements(!showAnnouncements)}
              activeOpacity={0.8}
            >
              <View style={styles.annSectionTitleWrap}>
                <Ionicons name="megaphone-outline" size={16} color={c.primary} />
                <Text style={[styles.annSectionTitle, { color: c.foreground }]}>Announcements</Text>
                <View style={[styles.annCount, { backgroundColor: `${c.primary}1F` }]}>
                  <Text style={[styles.annCountText, { color: c.primary }]}>{announcements.length}</Text>
                </View>
              </View>
              <Ionicons name={showAnnouncements ? 'chevron-up' : 'chevron-down'} size={18} color={c.mutedForeground} />
            </TouchableOpacity>

            {showAnnouncements && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.annScroller}>
                {announcements.map(ann => (
                  <AnnouncementCard key={ann.id} announcement={ann} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={[styles.tabs, { backgroundColor: c.muted }]}>
          <TouchableOpacity style={[styles.tabBtn, tab === 'inbox' && { backgroundColor: c.primary }]} onPress={() => setTab('inbox')} activeOpacity={0.8}>
            <Text style={[styles.tabText, { color: tab === 'inbox' ? '#FFFFFF' : c.foreground }]}>
              Inbox {unreadCount > 0 && <Text style={{ color: tab === 'inbox' ? '#FFFFFF' : c.destructive }}>· {unreadCount}</Text>}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === 'sent' && { backgroundColor: c.primary }]} onPress={() => setTab('sent')} activeOpacity={0.8}>
            <Text style={[styles.tabText, { color: tab === 'sent' ? '#FFFFFF' : c.foreground }]}>Sent</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={m => m.id}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.msgRow, { borderBottomColor: c.border }, !item.isRead && item.isInbox && { backgroundColor: `${c.primary}0F` }]}
              onPress={() => openMessage(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.senderAvatar, { backgroundColor: `${c.primary}33` }]}>
                <Text style={[styles.senderInitial, { color: c.foreground }]}>{item.isInbox ? item.senderName[0] : item.recipientName[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.msgMeta}>
                  <Text style={[styles.senderName, { color: !item.isRead && item.isInbox ? c.foreground : c.mutedForeground }]}>
                    {item.isInbox ? item.senderName : `To: ${item.recipientName}`}
                  </Text>
                  <Text style={[styles.msgDate, { color: c.mutedForeground }]}>
                    {new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Text style={[styles.msgSubject, { color: !item.isRead && item.isInbox ? c.foreground : c.mutedForeground }]}>{item.subject}</Text>
                <Text style={[styles.msgPreview, { color: c.mutedForeground }]} numberOfLines={1}>{item.body}</Text>
              </View>
              {!item.isRead && item.isInbox && <View style={[styles.unreadDot, { backgroundColor: c.primary }]} />}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mail-open-outline" size={48} color={c.mutedForeground} />
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                {tab === 'inbox' ? 'No messages from the school yet' : 'No sent messages'}
              </Text>
            </View>
          }
        />

        <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
          <View style={{ flex: 1, backgroundColor: c.background }}>
            <View style={[styles.modalHeader, { paddingTop: insets.top + 12, borderBottomColor: c.border }]}>
              <TouchableOpacity onPress={() => setSelected(null)}><Ionicons name="close" size={24} color={c.foreground} /></TouchableOpacity>
              <Text style={[styles.modalTitle, { color: c.foreground }]} numberOfLines={1}>{selected?.subject}</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.modalMeta}>
                <Text style={[styles.modalFrom, { color: c.mutedForeground }]}>
                  From: <Text style={{ color: c.foreground }}>{selected?.senderName}</Text>
                </Text>
                <Text style={[styles.modalDate, { color: c.mutedForeground }]}>
                  {selected ? new Date(selected.createdAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                </Text>
              </View>
              <Text style={[styles.modalBodyText, { color: c.foreground }]}>{selected?.body}</Text>
            </ScrollView>
          </View>
        </Modal>

        <Modal visible={composing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setComposing(false)}>
          <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.modalHeader, { paddingTop: insets.top + 12, borderBottomColor: c.border }]}>
              <TouchableOpacity onPress={() => setComposing(false)}><Text style={{ color: c.mutedForeground, fontSize: 15 }}>Cancel</Text></TouchableOpacity>
              <Text style={[styles.modalTitle, { color: c.foreground }]}>New Message</Text>
              <TouchableOpacity onPress={doSend} disabled={sending}>
                <Text style={{ color: sending ? c.mutedForeground : c.primary, fontSize: 15, fontWeight: '700' }}>Send</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.composeLabel, { color: c.mutedForeground }]}>To</Text>
              {contactsLoading ? (
                <View style={[styles.composeInput, { backgroundColor: c.input, borderColor: c.border }]}><ActivityIndicator size="small" color={c.primary} /></View>
              ) : contacts.length === 0 ? (
                <View style={[styles.composeInput, { backgroundColor: c.input, borderColor: c.border }]}>
                  <Text style={{ color: c.mutedForeground }}>
                    No contacts are available for your account yet. Please contact the school office.
                  </Text>
                </View>
              ) : (
                contacts.map(contact => (
                  <TouchableOpacity
                    key={contact.id}
                    style={[
                      styles.composeInput,
                      styles.contactRow,
                      { backgroundColor: c.input, borderColor: c.border },
                      recipientId === contact.id && { borderColor: c.primary, backgroundColor: `${c.primary}1F` },
                    ]}
                    onPress={() => setRecipientId(contact.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={recipientId === contact.id ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={recipientId === contact.id ? c.primary : c.mutedForeground}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.contactName, { color: c.foreground }]}>{contact.name}</Text>
                      <Text style={[styles.contactSub, { color: c.mutedForeground }]}>
                        {contact.class_name ? `${contact.role} · ${contact.class_name}` : contact.role}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
              <Text style={[styles.composeLabel, { color: c.mutedForeground }]}>Subject</Text>
              <TextInput style={[styles.composeTextInput, { backgroundColor: c.input, borderColor: c.border, color: c.foreground }]} value={composeSubject} onChangeText={setComposeSubject} placeholder="Enter subject…" placeholderTextColor={c.mutedForeground} />
              <Text style={[styles.composeLabel, { color: c.mutedForeground }]}>Message</Text>
              <TextInput style={[styles.composeTextInput, { height: 160, textAlignVertical: 'top', backgroundColor: c.input, borderColor: c.border, color: c.foreground }]} value={composeBody} onChangeText={setComposeBody} placeholder="Write your message…" placeholderTextColor={c.mutedForeground} multiline />
              {sending && <ActivityIndicator style={{ marginTop: 16 }} color={c.primary} />}
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </AuroraBackground>
  );
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const c = useColors();
  const isUrgent = announcement.category === 'urgent';
  return (
    <View style={[styles.annCard, { backgroundColor: c.card, borderColor: isUrgent ? c.destructive : c.border }]}>
      <View style={styles.annCardHead}>
        <View style={[styles.annDot, { backgroundColor: isUrgent ? c.destructive : c.primary }]} />
        <Text style={[styles.annCardTitle, { color: c.foreground }]} numberOfLines={1}>{announcement.title}</Text>
      </View>
      <Text style={[styles.annCardBody, { color: c.mutedForeground }]} numberOfLines={4}>{announcement.body}</Text>
      <Text style={[styles.annCardDate, { color: c.mutedForeground }]}>
        {new Date(announcement.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        {announcement.className ? ` · ${announcement.className}` : ' · All parents'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  unreadLine: { fontSize: 13, marginTop: 2 },
  composeBtn: { borderRadius: 20, overflow: 'hidden' },
  composeBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  composeBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  annSection: { paddingHorizontal: 20, marginBottom: 12 },
  annSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  annSectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  annSectionTitle: { fontSize: 15, fontWeight: '800' },
  annCount: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 1 },
  annCountText: { fontSize: 12, fontWeight: '700' },
  annScroller: { gap: 10, paddingVertical: 8 },
  annCard: { width: 260, borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  annCardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  annDot: { width: 8, height: 8, borderRadius: 4 },
  annCardTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  annCardBody: { fontSize: 12, lineHeight: 17 },
  annCardDate: { fontSize: 11 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, borderRadius: 14, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 12 },
  tabText: { fontSize: 14, fontWeight: '600' },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  senderAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  senderInitial: { fontSize: 16, fontWeight: '700' },
  msgMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  senderName: { fontSize: 13, fontWeight: '600' },
  msgDate: { fontSize: 11 },
  msgSubject: { fontSize: 14, fontWeight: '600', marginVertical: 2 },
  msgPreview: { fontSize: 12 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  modalBody: { padding: 20 },
  modalMeta: { marginBottom: 20, gap: 4 },
  modalFrom: { fontSize: 13 },
  modalDate: { fontSize: 12 },
  modalBodyText: { fontSize: 15, lineHeight: 24 },
  composeLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 16, marginBottom: 6 },
  composeInput: { borderRadius: 12, padding: 14, borderWidth: 1 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  contactName: { fontWeight: '600' },
  contactSub: { fontSize: 12 },
  composeTextInput: { borderRadius: 12, padding: 14, borderWidth: 1, fontSize: 15 },
});
