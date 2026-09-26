import React, { useEffect } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppMessage } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

interface Props {
  message: AppMessage | null;
  onClose: () => void;
}

/**
 * The full message. Opening one is also what marks it read (the database owns that
 * state through `mark_message_read`), so the unread styling stays truthful wherever
 * the parent opened it from — the inbox or the dashboard.
 */
export function MessageDetailModal({ message, onClose }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { markRead } = useApp();

  const unreadId = message?.isInbox && !message.isRead ? message.id : null;

  useEffect(() => {
    if (unreadId) markRead(unreadId);
  }, [unreadId]);

  if (!message) return null;

  const when = new Date(message.createdAt);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: c.overlay }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close message">
            <Ionicons name="close" size={24} color={c.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.foreground }]} numberOfLines={1}>Message</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.subject, { color: c.foreground }]}>{message.subject}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.from, { color: c.textSecondary }]}>
              {message.isInbox ? 'From' : 'To'}{' '}
              <Text style={{ color: c.foreground, fontWeight: '700' }}>
                {message.isInbox ? message.senderName : message.recipientName}
              </Text>
            </Text>
          </View>
          <Text style={[styles.date, { color: c.textDim }]}>
            {Number.isNaN(when.getTime())
              ? ''
              : when.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>

          <Text style={[styles.bodyText, { color: c.textBody }]} selectable>{message.body}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  body: { padding: 20, paddingBottom: 60 },
  subject: { fontSize: 20, fontWeight: '800', lineHeight: 27 },
  metaRow: { marginTop: 14 },
  from: { fontSize: 13.5 },
  date: { fontSize: 12.5, marginTop: 3 },
  bodyText: { fontSize: 15, lineHeight: 24, marginTop: 20 },
});
