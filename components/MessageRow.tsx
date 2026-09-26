import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Avatar } from '@/components/Avatar';
import type { AppMessage } from '@/data/mockData';
import { useColors } from '@/hooks/useColors';

interface Props {
  message: AppMessage;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** One row in the inbox (or sent list). Unread mail is loud; read mail is quiet. */
export function MessageRow({ message, onPress, style }: Props) {
  const c = useColors();
  const unread = message.isInbox && !message.isRead;
  const who = message.isInbox ? message.senderName : `To: ${message.recipientName}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.row,
        {
          backgroundColor: unread ? c.primarySoft : c.surface,
          borderColor: unread ? c.primary : c.border,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread message' : 'Message'} from ${who}: ${message.subject}`}
    >
      <Avatar name={who.replace(/^To:\s*/, '')} color={unread ? c.primary : c.tabBarInactive} size={40} />
      <View style={{ flex: 1 }}>
        <View style={styles.metaRow}>
          <Text style={[styles.sender, { color: unread ? c.foreground : c.textSecondary }]} numberOfLines={1}>
            {who}
          </Text>
          <Text style={[styles.when, { color: c.textDim }]}>{formatWhen(message.createdAt)}</Text>
        </View>
        <Text
          style={[styles.subject, { color: c.foreground }]}
          numberOfLines={1}
        >
          {message.subject}
        </Text>
        <Text style={[styles.preview, { color: c.textSecondary }]} numberOfLines={1}>{message.body}</Text>
      </View>
      {unread ? <View style={[styles.dot, { backgroundColor: c.primary }]} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sender: { fontSize: 12.5, fontWeight: '700', flex: 1 },
  when: { fontSize: 11 },
  subject: { fontSize: 14.5, fontWeight: '600', marginVertical: 2 },
  preview: { fontSize: 12.5 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
});
