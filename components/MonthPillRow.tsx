import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { FULL_MONTH_NAMES, type MonthPillState } from '@/lib/reportSelectors';
import { useColors } from '@/hooks/useColors';

/**
 * Two sizes of the same pill. The compact row sits inside a child card, where it has to
 * stay short; the roomy one is the marks screen's month control, where it is the thing
 * being tapped. Widths are measured, never assumed — the row shares whatever room it is
 * given between the months it shows, and scrolls rather than wrapping when they do not
 * all fit.
 */
const SIZES = {
  compact: { height: 26, fontSize: 9.5, minWidth: 26, maxWidth: 40, gap: 2, hitSlop: 8 },
  roomy: { height: 34, fontSize: 12, minWidth: 44, maxWidth: 64, gap: 6, hitSlop: 6 },
} as const;

interface Props {
  /** A child's twelve months; only the ones carrying published marks are drawn. */
  months: MonthPillState[];
  onSelect: (month: MonthPillState) => void;
  size?: keyof typeof SIZES;
  /**
   * Draws it as a chooser: the month already on screen is filled, the other months that
   * have marks sit behind it as tappable but unselected.
   */
  selectable?: boolean;
  /** The month already on screen, when there is one. */
  activeMonth?: string;
  activeYearKey?: string;
}

/**
 * A child's published months as pills, Jan → Dec. Months with nothing entered are left
 * out rather than shown empty — a parent scanning the dashboard is looking for what the
 * school has published, not for the months it has not.
 */
export function MonthPillRow({
  months,
  onSelect,
  size = 'compact',
  selectable = false,
  activeMonth,
  activeYearKey,
}: Props) {
  const c = useColors();
  const metrics = SIZES[size];
  const [rowWidth, setRowWidth] = useState(0);

  const shown = months.filter(month => month.hasMarks);

  const pillWidth = rowWidth > 0 && shown.length > 0
    ? Math.min(
        metrics.maxWidth,
        Math.max(
          metrics.minWidth,
          Math.floor((rowWidth - metrics.gap * (shown.length - 1)) / shown.length),
        ),
      )
    : metrics.minWidth;

  const onLayout = (event: LayoutChangeEvent) => setRowWidth(event.nativeEvent.layout.width);

  if (shown.length === 0) return null;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={[styles.row, { gap: metrics.gap }]}
      >
        {shown.map(month => {
          const active = !!activeMonth
            && month.academicMonth === activeMonth
            && (!activeYearKey || month.yearKey === activeYearKey);
          const solid = !selectable || active;
          // A chooser has to show the road not taken: published months stay visible, but
          // only the open one is filled.
          const fill = solid
            ? c.primary
            : c.primarySoft;
          const border = solid ? (active ? c.onBrand : c.primary) : c.primary;
          const text = solid ? c.primaryForeground : c.primary;
          const year = month.year === null ? '' : ` ${month.year}`;

          return (
            <TouchableOpacity
              key={month.label}
              style={[
                styles.pill,
                {
                  width: pillWidth,
                  height: metrics.height,
                  borderRadius: metrics.height / 2,
                  backgroundColor: fill,
                  borderColor: border,
                },
              ]}
              onPress={() => onSelect(month)}
              activeOpacity={0.8}
              hitSlop={{ top: metrics.hitSlop, bottom: metrics.hitSlop }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${FULL_MONTH_NAMES[month.index] ?? month.label}${year} report, ${month.count} subject${month.count === 1 ? '' : 's'} published`}
            >
              <Text style={[styles.text, { fontSize: metrics.fontSize, color: text }]} numberOfLines={1}>
                {month.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  row: { alignItems: 'center' },
  pill: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  text: { fontWeight: '700' },
});
