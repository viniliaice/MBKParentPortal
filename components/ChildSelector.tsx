import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/Avatar';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

interface Props {
  style?: StyleProp<ViewStyle>;
  /** Tighter chips, for the marks screen where the selector sits under a title. */
  dense?: boolean;
}

/**
 * The child switcher. It reads and writes the one selected-child value in `AppContext`,
 * so a switch here changes home, marks and attendance together — the parent never has
 * to work out which child a screen is showing.
 *
 * With a single child it degrades to a plain identity row: still obvious *who* the
 * screen is about, without a control that has nothing to switch to.
 */
export function ChildSelector({ style, dense }: Props) {
  const { students, selectedStudentId, selectedStudent, setSelectedStudentId } = useApp();
  const c = useColors();

  if (students.length === 0 || !selectedStudent) return null;

  const switchTo = (id: string) => {
    if (id === selectedStudentId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedStudentId(id);
  };

  if (students.length === 1) {
    return (
      <View style={[styles.single, style]}>
        <Avatar name={selectedStudent.name} color={selectedStudent.avatarColor} size={30} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.singleName, { color: c.foreground }]} numberOfLines={1}>{selectedStudent.name}</Text>
          <Text style={[styles.singleClass, { color: c.textSecondary }]} numberOfLines={1}>{selectedStudent.grade}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, dense && styles.rowDense, style]}
    >
      {students.map(student => {
        const selected = student.id === selectedStudent.id;
        const firstName = student.name.split(' ')[0];
        return (
          <TouchableOpacity
            key={student.id}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? c.primarySoft : c.surface,
                borderColor: selected ? c.primary : c.border,
              },
            ]}
            onPress={() => switchTo(student.id)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show ${student.name}, ${student.grade}`}
          >
            <Avatar name={student.name} color={student.avatarColor} size={30} />
            <View style={{ flexShrink: 1 }}>
              <Text
                style={[styles.chipName, { color: selected ? c.primary : c.foreground }]}
                numberOfLines={1}
              >
                {firstName}
              </Text>
              {/* Class, then the school's own student number — how the office refers to the child. */}
              <Text style={[styles.chipClass, { color: c.textSecondary }]} numberOfLines={1}>
                {student.id ? `${student.grade} · ${student.id}` : student.grade}
              </Text>
            </View>
            {selected ? <Ionicons name="checkmark-circle" size={16} color={c.primary} /> : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: 10, paddingVertical: 2 },
  rowDense: { paddingHorizontal: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1.5,
    maxWidth: 220,
  },
  chipName: { fontSize: 14, fontWeight: '700', maxWidth: 120 },
  chipClass: { fontSize: 11, marginTop: 1 },
  single: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  singleName: { fontSize: 15, fontWeight: '700' },
  singleClass: { fontSize: 12, marginTop: 1 },
});
