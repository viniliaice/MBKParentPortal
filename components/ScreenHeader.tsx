import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTopPadding } from '@/hooks/useScreenInsets';

interface Props {
  title?: string;
  onBack?: () => void;
  /** Right-hand control (a button); the header reserves its width either way. */
  right?: React.ReactNode;
  /** Shown under the title, e.g. a child's name and class. */
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  /** Larger title treatment for a tab root; screens in the stack use the default. */
  size?: 'screen' | 'tab';
}

/**
 * The header for a pushed screen: back affordance, one title, one action.
 * Kept deliberately short so content starts as high up as possible.
 */
export function ScreenHeader({ title, onBack, right, subtitle, style, size = 'screen' }: Props) {
  const c = useColors();
  const topPad = useTopPadding();

  return (
    <View style={[styles.header, { paddingTop: topPad + 8 }, style]}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={[styles.iconBtn, { backgroundColor: c.surfaceMuted }]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={c.foreground} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.titleWrap}>
        {title ? (
          <Text
            style={[styles.title, { color: c.foreground }, size === 'tab' && styles.tabTitle]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>

      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1 },
  title: { fontSize: 19, fontWeight: '800' },
  tabTitle: { fontSize: 24 },
  subtitle: { fontSize: 13, marginTop: 1 },
  right: { minWidth: 38, alignItems: 'flex-end' },
});
