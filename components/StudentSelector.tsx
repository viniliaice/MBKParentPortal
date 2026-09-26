import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

interface StudentLike {
  id: string;
  name: string;
  avatarColor: string;
}

interface Props {
  students: StudentLike[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** quizzes/history/attendance truncate to first name; results shows full name */
  fullName?: boolean;
  style?: ViewStyle;
}

/**
 * The same student-picker row was copy-pasted in quizzes/index.tsx,
 * quizzes/history.tsx, attendance.tsx, and results.tsx — same JSX, same
 * style names, same `s.name.split(' ')[0]` truncation. One shared component
 * instead of four hand-kept copies.
 */
export default function StudentSelector({ students, selectedId, onSelect, fullName, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      {students.map(s => {
        const isSelected = selectedId === s.id;
        return (
          <TouchableOpacity
            key={s.id}
            style={[styles.btn, isSelected && { borderColor: s.avatarColor, backgroundColor: `${s.avatarColor}22` }]}
            onPress={() => onSelect(s.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, isSelected && { color: s.avatarColor }]}>
              {fullName ? s.name : s.name.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 12 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  btnText: { fontSize: 14, fontWeight: '700', color: '#8892B0' },
});
