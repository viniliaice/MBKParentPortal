import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  title: string;
  /** Optional right-hand link, e.g. "See all". */
  actionLabel?: string;
  onAction?: () => void;
  /** Keeps the header flush with a screen's 20pt gutter (default) or cards/padding of its own. */
  style?: React.ComponentProps<typeof View>['style'];
}

/** A section label above a group of cards. Quiet, uppercase, never competing with the content. */
export function SectionHeader({ title, actionLabel, onAction, style }: Props) {
  const c = useColors();

  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.title, { color: c.textSecondary }]}>{title.toUpperCase()}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7} accessibilityRole="button">
          <Text style={[styles.action, { color: c.primary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 10,
  },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  action: { fontSize: 13, fontWeight: '700' },
});
