import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** e.g. "4 subjects · 78% average", or the reason it is not there yet. */
  detail: string;
  /** Highlighted when results exist for this period. */
  hasResults: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** A primary way into one of the three report periods — not a menu item. */
export function ReportPeriodCard({ label, icon, detail, hasResults, onPress, style }: Props) {
  const c = useColors();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: c.surface, borderColor: hasResults ? c.primarySoft : c.border }, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${label} reports. ${detail}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: hasResults ? c.primarySoft : c.surfaceMuted }]}>
        <Ionicons name={icon} size={20} color={hasResults ? c.primary : c.textDim} />
      </View>
      <Text style={[styles.label, { color: c.foreground }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.detail, { color: hasResults ? c.textSecondary : c.textDim }]} numberOfLines={2}>{detail}</Text>
      <View style={styles.footer}>
        <Text style={[styles.cta, { color: c.primary }]}>View</Text>
        <Ionicons name="chevron-forward" size={14} color={c.primary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 18, borderWidth: 1.5, padding: 14, gap: 6, minHeight: 138 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  label: { fontSize: 15, fontWeight: '800' },
  detail: { fontSize: 11.5, lineHeight: 16, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  cta: { fontSize: 12.5, fontWeight: '700' },
});
