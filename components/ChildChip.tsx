import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useTheme } from '@/hooks/useColors';

interface ChildChipProps {
  name: string;
  className: string;
  grade: string;
  avatarColor: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * A child as a horizontal, horizontal-scrollable chip. Used across Marks,
 * Attendance, Quizzes and the Home selector so switching children always looks
 * and behaves the same.
 */
export default function ChildChip({ name, className, grade, avatarColor, selected, onPress }: ChildChipProps) {
  const c = useColors();
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}, ${className}`}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: c.card, borderColor: selected ? avatarColor : c.border },
        selected ? t.shadow : null,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: `${avatarColor}26` }]}>
        <Text style={[styles.initial, { color: avatarColor }]}>{name[0]?.toUpperCase() ?? '?'}</Text>
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.sub, { color: c.mutedForeground }]} numberOfLines={1}>{className}</Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={18} color={avatarColor} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    maxWidth: 250,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 13, fontWeight: '800' },
  textCol: { flexShrink: 1 },
  name: { fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 11, marginTop: 1 },
});
