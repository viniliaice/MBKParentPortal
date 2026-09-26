import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme, type ThemePreference } from '@/context/ThemeContext';

const OPTIONS: { key: ThemePreference; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

/**
 * The Light / Dark control. It writes to `ThemeContext`, which every screen reads
 * its colours from, and the choice is stored on the device.
 */
export function AppearanceToggle() {
  const { preference, setPreference } = useTheme();
  const c = useColors();

  return (
    <View style={[styles.row, { backgroundColor: c.surfaceMuted }]}>
      {OPTIONS.map(option => {
        const active = preference === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.option,
              active && { backgroundColor: c.surface, borderColor: c.primary },
            ]}
            onPress={() => setPreference(option.key)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${option.label} appearance`}
          >
            <Ionicons name={option.icon} size={17} color={active ? c.primary : c.textSecondary} />
            <Text style={[styles.label, { color: active ? c.primary : c.textSecondary }]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4, borderRadius: 14, gap: 4 },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  label: { fontSize: 13.5, fontWeight: '700' },
});
