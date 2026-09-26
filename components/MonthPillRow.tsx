import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { fullMonthName, type MonthPillState } from '@/lib/reportSelectors';
import { useColors } from '@/hooks/useColors';

/**
 * Small enough to keep the child card short, wide enough that 'Sep' never clips.
 * The row is measured, not assumed: twelve pills share whatever width they are given
 * and the row scrolls — rather than wrapping into a second line — when they cannot.
 */
const PILL_HEIGHT = 26;
/** 'May' is the widest three-letter label; 26pt fits it with room either side. */
const PILL_MIN_WIDTH = 26;
const PILL_GAP = 2;
/** Vertical reach added without adding height, so the pills stay easy to hit. */
const HIT_SLOP = 8;

interface Props {
  months: MonthPillState[];
  onSelect: (month: MonthPillState) => void;
  /** The month whose report is already on screen (marks screen) — ringed, not just filled. */
  activeMonth?: string;
  activeYearKey?: string;
}

/**
 * One child's school year at a glance: twelve month pills, Jan → Dec, filled with the
 * brand colour when that month's marks are published and left as an outlined pill when
 * they are not. Months without marks are not pressable — there is nothing to open.
 */
export function MonthPillRow({ months, onSelect, activeMonth, activeYearKey }: Props) {
  const c = useColors();
  const [rowWidth, setRowWidth] = useState(0);

  const pillWidth = rowWidth > 0 && months.length > 0
    ? Math.max(
        PILL_MIN_WIDTH,
        Math.floor((rowWidth - PILL_GAP * (months.length - 1)) / months.length),
      )
    : PILL_MIN_WIDTH;

  const onLayout = (event: LayoutChangeEvent) => setRowWidth(event.nativeEvent.layout.width);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.row}
      >
        {months.map(month => {
          const active = !!activeMonth
            && month.academicMonth === activeMonth
            && (!activeYearKey || month.yearKey === activeYearKey);
          const year = month.year === null ? '' : ` ${month.year}`;

          return (
            <TouchableOpacity
              key={month.label}
              style={[
                styles.pill,
                { width: pillWidth },
                month.hasMarks
                  // A white ring on the brand fill: the month whose report is on screen,
                  // without spending a second colour on it.
                  ? { backgroundColor: c.primary, borderColor: active ? c.onBrand : c.primary, borderWidth: active ? 1.5 : 1 }
                  : { backgroundColor: c.card, borderColor: c.borderStrong },
              ]}
              onPress={() => onSelect(month)}
              disabled={!month.hasMarks}
              activeOpacity={0.8}
              hitSlop={{ top: HIT_SLOP, bottom: HIT_SLOP }}
              accessibilityRole="button"
              accessibilityState={{ disabled: !month.hasMarks, selected: active }}
              accessibilityLabel={month.hasMarks
                ? `${fullMonthName(month.index)}${year} report, ${month.count} subject${month.count === 1 ? '' : 's'} published`
                : `${fullMonthName(month.index)}${year}, no marks published`}
            >
              <Text
                style={[styles.text, { color: month.hasMarks ? c.primaryForeground : c.textSecondary }]}
                numberOfLines={1}
              >
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
  row: { gap: PILL_GAP, alignItems: 'center' },
  pill: {
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 1,
  },
  text: { fontSize: 9.5, fontWeight: '700' },
});
