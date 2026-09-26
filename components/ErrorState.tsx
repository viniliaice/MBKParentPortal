import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  message: string;
  onRetry?: () => void;
  /** True while the retry is in flight. */
  retrying?: boolean;
}

/** A failed load a parent can do something about — never a blank screen. */
export function ErrorState({ message, onRetry, retrying }: Props) {
  const c = useColors();

  return (
    <View style={[styles.wrap, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Ionicons name="cloud-offline-outline" size={26} color={c.warning} />
      <Text style={[styles.message, { color: c.textBody }]}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          disabled={retrying}
          style={[styles.retry, { backgroundColor: c.primarySoft, opacity: retrying ? 0.6 : 1 }]}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={[styles.retryText, { color: c.primary }]}>{retrying ? 'Trying…' : 'Try again'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, borderRadius: 18, borderWidth: 1, padding: 20, alignItems: 'center', gap: 10 },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },
  retryText: { fontSize: 14, fontWeight: '700' },
});
