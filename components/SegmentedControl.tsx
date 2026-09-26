import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  /** Optional count shown next to the label, e.g. unread mail. */
  count?: number;
  /** Shows a dot instead of a number, for "there is something here". */
  dot?: boolean;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Let the row scroll when the labels are long (small screens, large fonts). */
  scrollable?: boolean;
  style?: React.ComponentProps<typeof View>['style'];
}

/** The app's one segmented control: used for report periods and the message views. */
export function SegmentedControl<T extends string>({ options, value, onChange, scrollable, style }: Props<T>) {
  const c = useColors();

  const content = options.map(option => {
    const active = option.key === value;
    return (
      <TouchableOpacity
        key={option.key}
        style={[styles.segment, active && { backgroundColor: c.surface, borderColor: c.primary }, scrollable && styles.segmentScrollable]}
        onPress={() => onChange(option.key)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text
          style={[styles.label, { color: active ? c.primary : c.textSecondary }]}
          numberOfLines={1}
        >
          {option.label}
        </Text>
        {typeof option.count === 'number' && option.count > 0 ? (
          <View style={[styles.count, { backgroundColor: active ? c.primarySoft : c.badge }]}>
            <Text style={[styles.countText, { color: active ? c.primary : c.textSecondary }]}>{option.count}</Text>
          </View>
        ) : null}
        {option.dot ? <View style={[styles.dot, { backgroundColor: active ? c.primary : c.destructive }]} /> : null}
      </TouchableOpacity>
    );
  });

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.rowScrollable, style]}>
        {content}
      </ScrollView>
    );
  }

  return <View style={[styles.row, { backgroundColor: c.surfaceMuted }, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4, borderRadius: 14, gap: 4, marginHorizontal: 20 },
  rowScrollable: { paddingHorizontal: 20, gap: 8, flexDirection: 'row' },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 42,
  },
  segmentScrollable: { flex: 0, minWidth: 92 },
  label: { fontSize: 13.5, fontWeight: '700' },
  count: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  countText: { fontSize: 11, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
