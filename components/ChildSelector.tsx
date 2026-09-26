import React, { useEffect, useMemo, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { MonthPillRow } from '@/components/MonthPillRow';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { monthPillStates, type MonthPillState } from '@/lib/reportSelectors';

/**
 * The root layout centres every screen in a 720pt column, so a wide browser window must
 * not stretch a carousel card past the column the rest of the screen sits in.
 */
const CONTENT_MAX_WIDTH = 720;
/** The 20pt gutter either side of a screen, which a carousel card has to sit inside. */
const SCREEN_GUTTER = 40;
/** Gap between two carousel cards — also the distance the carousel scrolls per child. */
const CARD_GAP = 10;

interface Props {
  style?: StyleProp<ViewStyle>;
  /** Tighter chips, for the marks screen where the selector sits under a title. */
  dense?: boolean;
  /** Adds each child's twelve month pills. Off where another month control already sits. */
  showMonths?: boolean;
  /**
   * Opens a month without leaving the current screen. The marks screen is already on the
   * report, so it moves its own month rather than navigating to itself.
   */
  onSelectMonth?: (studentId: string, month: MonthPillState) => void;
  /** The month already on screen, ringed on every child it belongs to. */
  activeMonth?: string;
  activeYearKey?: string;
}

/**
 * The child switcher. It reads and writes the one selected-child value in `AppContext`,
 * so a switch here changes home, marks and attendance together — the parent never has
 * to work out which child a screen is showing.
 *
 * With a single child it degrades to a plain identity row: still obvious *who* the
 * screen is about, without a control that has nothing to switch to.
 */
export function ChildSelector({
  style,
  dense,
  showMonths = false,
  onSelectMonth,
  activeMonth,
  activeYearKey,
}: Props) {
  const { students, selectedStudentId, selectedStudent, setSelectedStudentId, results, academicYears } = useApp();
  const c = useColors();
  const { width: windowWidth } = useWindowDimensions();

  // A child with no monthly marks yet still needs a year to hang the row on: the
  // school's own current one, which is where their first report will land.
  const currentYearKey = useMemo(() => {
    const current = academicYears.find(y => y.isCurrent);
    return current ? current.name.replace('/', '-') : '';
  }, [academicYears]);

  // Every child's strip is derived from their own results, so two children in the same
  // account never borrow a month from each other.
  const pillsByStudent = useMemo(() => {
    if (!showMonths) return null;
    return new Map(students.map(s => [s.id, monthPillStates(results, s.id, currentYearKey)]));
  }, [showMonths, students, results, currentYearKey]);

  const cardWidth = Math.min(windowWidth - SCREEN_GUTTER, CONTENT_MAX_WIDTH - SCREEN_GUTTER);

  // The month pills belong to the child whose card they sit on, so the card on screen has
  // to be the child the rest of the screen is showing. The first alignment is instant —
  // an app that remembers the last child must not open by sliding past the others.
  const carousel = useRef<ScrollView>(null);
  const hasAligned = useRef(false);
  useEffect(() => {
    if (students.length < 2) return;
    const index = students.findIndex(s => s.id === selectedStudentId);
    if (index <= 0) return;
    const frame = requestAnimationFrame(() => {
      carousel.current?.scrollTo({ x: index * (cardWidth + CARD_GAP), animated: hasAligned.current });
      hasAligned.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedStudentId, students, cardWidth]);

  if (students.length === 0 || !selectedStudent) return null;

  const switchTo = (id: string) => {
    if (id === selectedStudentId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedStudentId(id);
  };

  const selectMonth = (studentId: string, month: MonthPillState) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onSelectMonth) {
      onSelectMonth(studentId, month);
      return;
    }
    // The report being opened belongs to this child, so the rest of the app follows.
    if (studentId !== selectedStudentId) setSelectedStudentId(studentId);
    router.push({
      pathname: '/(tabs)/marks',
      params: {
        period: 'monthly',
        student: studentId,
        month: month.academicMonth,
        year: month.yearKey,
      },
    });
  };

  if (students.length === 1) {
    const pills = pillsByStudent?.get(selectedStudent.id);

    return (
      <View style={[styles.single, style]}>
        <View style={styles.identity}>
          <Avatar name={selectedStudent.name} color={selectedStudent.avatarColor} size={30} />
          <Text style={[styles.singleName, { color: c.foreground }]} numberOfLines={1}>
            {selectedStudent.name}
          </Text>
          <Text style={[styles.dot, { color: c.textDim }]}>·</Text>
          <Text style={[styles.singleGrade, { color: c.textSecondary }]} numberOfLines={1}>
            {selectedStudent.grade}
          </Text>
        </View>
        {pills ? (
          <MonthPillRow
            months={pills.months}
            onSelect={month => selectMonth(selectedStudent.id, month)}
            activeMonth={activeMonth}
            activeYearKey={activeYearKey}
          />
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      ref={carousel}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, dense && styles.rowDense, style]}
    >
      {students.map(student => {
        const selected = student.id === selectedStudent.id;
        const firstName = student.name.split(' ')[0];
        const pills = pillsByStudent?.get(student.id);

        return (
          <View
            key={student.id}
            style={[
              styles.chip,
              {
                width: cardWidth,
                backgroundColor: selected ? c.primarySoft : c.surface,
                borderColor: selected ? c.primary : c.border,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.identity}
              onPress={() => switchTo(student.id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show ${student.name}, ${student.grade}`}
            >
              <Avatar name={student.name} color={student.avatarColor} size={30} />
              <View style={styles.identityText}>
                <Text
                  style={[styles.chipName, { color: selected ? c.primary : c.foreground }]}
                  numberOfLines={1}
                >
                  {firstName}
                </Text>
                <Text style={[styles.dot, { color: c.textDim }]}>·</Text>
                {/* The grade, and nothing else: the school's student number is not a
                    parent-facing detail and only made the card wider and taller. */}
                <Text style={[styles.chipGrade, { color: c.textSecondary }]} numberOfLines={1}>
                  {student.grade}
                </Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={16} color={c.primary} /> : null}
            </TouchableOpacity>

            {pills ? (
              <MonthPillRow
                months={pills.months}
                onSelect={month => selectMonth(student.id, month)}
                activeMonth={activeMonth}
                activeYearKey={activeYearKey}
              />
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: CARD_GAP, paddingVertical: 2 },
  rowDense: { paddingHorizontal: 20 },
  chip: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 6,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  identityText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipName: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  chipGrade: { fontSize: 11.5, flexShrink: 0 },
  dot: { fontSize: 11.5 },
  single: { paddingHorizontal: 20, gap: 8 },
  singleName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  singleGrade: { fontSize: 12, flexShrink: 0 },
});
