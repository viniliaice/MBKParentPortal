import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import type { AnnouncementData } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

interface Props {
  announcement: AnnouncementData;
  /** Newer than the last time the parent opened the announcements list. */
  isNew?: boolean;
  /** Clamp the body — used by the preview on the dashboard. */
  numberOfLines?: number;
  /** Tapping opens the announcements list (the dashboard preview). */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

/**
 * An announcement. The `announcements` table carries a class name, the message, who
 * wrote it and when — there is no title or sender-name column, so the card uses what
 * the school actually stores instead of inventing a headline or a signature.
 */
export function AnnouncementCard({ announcement, isNew, numberOfLines, onPress, style }: Props) {
  const c = useColors();

  const content = (
    <>
      <View style={styles.header}>
        <View style={[styles.source, { backgroundColor: c.primarySoft }]}>
          <Ionicons name="megaphone-outline" size={13} color={c.primary} />
          <Text style={[styles.sourceText, { color: c.primary }]} numberOfLines={1}>
            {announcement.className ? announcement.className : 'School'}
          </Text>
        </View>
        {isNew ? (
          <View style={[styles.newPill, { backgroundColor: c.primary }]}>
            <Text style={[styles.newText, { color: c.onBrand }]}>NEW</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.title, { color: c.foreground }]} numberOfLines={2}>{announcement.title}</Text>
      <Text style={[styles.body, { color: c.textBody }]} numberOfLines={numberOfLines}>{announcement.body}</Text>
      <Text style={[styles.date, { color: c.textDim }]}>{formatDateTime(announcement.date)}</Text>
    </>
  );

  if (!onPress) {
    return <Card style={[styles.card, isNew && { borderColor: c.primary }, style]}>{content}</Card>;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Announcement: ${announcement.title}`}
      style={[
        styles.card,
        styles.tappable,
        {
          backgroundColor: c.surface,
          borderColor: isNew ? c.primary : c.border,
        },
        style,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 10, gap: 6 },
  tappable: { borderWidth: 1, borderRadius: 18, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, maxWidth: '75%' },
  sourceText: { fontSize: 11, fontWeight: '700' },
  newPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  newText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 13.5, lineHeight: 20 },
  date: { fontSize: 11.5, marginTop: 2 },
});
