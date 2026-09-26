import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

/**
 * One shared Loading/Empty/Error treatment so every screen in either theme
 * shows the same calm states instead of per-screen one-offs.
 */
export function LoadingView() {
  const c = useColors();
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={c.primary} />
      <Text style={[styles.caption, { color: c.mutedForeground }]}>Loading…</Text>
    </View>
  );
}

export function EmptyState({ icon, title, message }: { icon: keyof typeof Ionicons.glyphMap; title: string; message?: string }) {
  const c = useColors();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: c.card, borderColor: c.border }]}>
        <Ionicons name={icon} size={28} color={c.mutedForeground} />
      </View>
      <Text style={[styles.title, { color: c.foreground }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: c.mutedForeground }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
    minHeight: 160,
  },
  caption: { fontSize: 13 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
