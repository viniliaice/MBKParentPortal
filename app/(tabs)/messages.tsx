import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuroraBackground from '@/components/AuroraBackground';
import { AnnouncementCard } from '@/components/AnnouncementCard';
import { EmptyState } from '@/components/EmptyState';
import { MessageDetailModal } from '@/components/MessageDetailModal';
import { MessageRow } from '@/components/MessageRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTabBarSpacing } from '@/hooks/useScreenInsets';
import type { AppMessage } from '@/data/mockData';
import type { SupabaseContact } from '@/lib/supabase';

type View_ = 'inbox' | 'announcements' | 'sent';

/**
 * Messages and announcements in one place, because to a parent they are the same
 * thing: what the school needs me to know.
 *
 * Unread mail is what the tab badge counts, and the announcements list marks what is
 * new since the parent last opened it. Both reuse the existing data — `messages.readAt`
 * on the server, a device-local "last opened" marker for announcements (the
 * announcements table has no read state of its own).
 */
export default function MessagesScreen() {
  const params = useLocalSearchParams<{ view?: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const tabSpacing = useTabBarSpacing();
  const {
    messages, announcements, unreadCount, newAnnouncementsCount, announcementsSeenAt,
    markAnnouncementsSeen, sendMessage, loadContacts, refresh,
  } = useApp();

  const [view, setView] = useState<View_>(params.view === 'announcements' || params.view === 'sent' ? params.view : 'inbox');
  const [selected, setSelected] = useState<AppMessage | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [contacts, setContacts] = useState<SupabaseContact[]>([]);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * The seen-marker as it was when the announcements list was opened, so the NEW pills
   * stay visible for this visit while the badge behind them clears.
   */
  const [seenMark, setSeenMark] = useState<string | null>(null);
  const openedAnnouncements = useRef(false);

  useEffect(() => {
    if (params.view === 'announcements' || params.view === 'sent') setView(params.view);
  }, [params.view]);

  const inbox = useMemo(
    () => messages.filter(m => m.isInbox).sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    }),
    [messages],
  );
  const sent = useMemo(() => messages.filter(m => !m.isInbox), [messages]);

  // Opening the announcements list is what marks them seen — but the marker is read
  // first, so "what is new" answers the question the parent actually has.
  useEffect(() => {
    if (view !== 'announcements' || openedAnnouncements.current) return;
    openedAnnouncements.current = true;
    setSeenMark(announcementsSeenAt ?? '');
    markAnnouncementsSeen();
  }, [view, announcementsSeenAt, markAnnouncementsSeen]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

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
    setView('sent');
  };

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Messages"
          size="tab"
          subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'Updates from the school'}
          right={
            <TouchableOpacity
              onPress={openCompose}
              style={[styles.composeBtn, { backgroundColor: c.primary }]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Write a message"
            >
              <Ionicons name="create-outline" size={18} color={c.onBrand} />
            </TouchableOpacity>
          }
        />

        <SegmentedControl
          options={[
            { key: 'inbox' as const, label: 'Inbox', count: unreadCount },
            { key: 'announcements' as const, label: 'Announcements', count: newAnnouncementsCount },
            { key: 'sent' as const, label: 'Sent' },
          ]}
          value={view}
          onChange={setView}
          style={{ marginBottom: 12 }}
        />

        {view === 'announcements' ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: tabSpacing + 12 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />
            }
          >
            {announcements.length === 0 ? (
              <EmptyState
                icon="megaphone-outline"
                title="No announcements yet"
                message="School notices and class announcements will appear here."
              />
            ) : (
              announcements.map(announcement => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  isNew={!!seenMark && announcement.date > seenMark}
                />
              ))
            )}
          </ScrollView>
        ) : (
          <FlatList
            data={view === 'inbox' ? inbox : sent}
            keyExtractor={m => m.id}
            contentContainerStyle={{ paddingBottom: tabSpacing + 12, flexGrow: 1 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />
            }
            renderItem={({ item }) => <MessageRow message={item} onPress={() => setSelected(item)} />}
            ListEmptyComponent={
              view === 'inbox' ? (
                <EmptyState
                  icon="mail-open-outline"
                  title="No messages yet"
                  message="Messages from your child's teachers and the school office arrive here."
                />
              ) : (
                <EmptyState
                  icon="paper-plane-outline"
                  title="Nothing sent yet"
                  message="Messages you send to the school appear here."
                />
              )
            }
          />
        )}

        <MessageDetailModal message={selected} onClose={() => setSelected(null)} />

        <Modal visible={composing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setComposing(false)}>
          <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.overlay }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.modalHeader, { paddingTop: insets.top + 12, borderBottomColor: c.border }]}>
              <TouchableOpacity onPress={() => setComposing(false)} accessibilityRole="button">
                <Text style={{ color: c.textSecondary, fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: c.foreground }]}>New message</Text>
              <TouchableOpacity onPress={doSend} disabled={sending} accessibilityRole="button">
                <Text style={{ color: sending ? c.textDim : c.primary, fontSize: 15, fontWeight: '700' }}>
                  {sending ? 'Sending…' : 'Send'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.composeLabel, { color: c.textSecondary }]}>To</Text>
              {contactsLoading ? (
                <View style={[styles.composeInput, { backgroundColor: c.inputBackground, borderColor: c.inputBorder }]}>
                  <ActivityIndicator size="small" color={c.primary} />
                </View>
              ) : contacts.length === 0 ? (
                <View style={[styles.composeInput, { backgroundColor: c.inputBackground, borderColor: c.inputBorder }]}>
                  <Text style={{ color: c.textSecondary }}>
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
                      {
                        backgroundColor: recipientId === contact.id ? c.primarySoft : c.inputBackground,
                        borderColor: recipientId === contact.id ? c.primary : c.inputBorder,
                      },
                    ]}
                    onPress={() => setRecipientId(contact.id)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: recipientId === contact.id }}
                  >
                    <Ionicons
                      name={recipientId === contact.id ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={recipientId === contact.id ? c.primary : c.textDim}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontWeight: '600' }}>{contact.name}</Text>
                      <Text style={{ color: c.textSecondary, fontSize: 12 }}>
                        {contact.class_name ? `${contact.role} · ${contact.class_name}` : contact.role}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
              <Text style={[styles.composeLabel, { color: c.textSecondary }]}>Subject</Text>
              <TextInput
                style={[styles.composeTextInput, { backgroundColor: c.inputBackground, borderColor: c.inputBorder, color: c.foreground }]}
                value={composeSubject}
                onChangeText={setComposeSubject}
                placeholder="Enter subject…"
                placeholderTextColor={c.placeholder}
              />
              <Text style={[styles.composeLabel, { color: c.textSecondary }]}>Message</Text>
              <TextInput
                style={[styles.composeTextInput, styles.composeMultiline, { backgroundColor: c.inputBackground, borderColor: c.inputBorder, color: c.foreground }]}
                value={composeBody}
                onChangeText={setComposeBody}
                placeholder="Write your message…"
                placeholderTextColor={c.placeholder}
                multiline
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  composeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalBody: { padding: 20, paddingBottom: 60 },
  composeLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, marginTop: 16, marginBottom: 6 },
  composeInput: { borderRadius: 12, padding: 14, borderWidth: 1 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  composeTextInput: { borderRadius: 12, padding: 14, borderWidth: 1, fontSize: 15 },
  composeMultiline: { height: 160, textAlignVertical: 'top' },
});
