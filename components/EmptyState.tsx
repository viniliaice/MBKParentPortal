import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** The calm version of "nothing here yet" — an explanation, not an error. */
export function EmptyState({ icon = 'file-tray-outline', title, message, actionLabel, onAction }: Props) {
  const c = useColors();

  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: c.surfaceMuted }]}>
        <Ionicons name={icon} size={26} color={c.textDim} />
      </View>
      <Text style={[styles.title, { color: c.foreground }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: c.textSecondary }]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          style={[styles.action, { backgroundColor: c.primarySoft }]}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={[styles.actionText, { color: c.primary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24, gap: 8 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  action: { marginTop: 10, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  actionText: { fontSize: 14, fontWeight: '700' },
});
