import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import ChildChip from '@/components/ChildChip';

export interface SelectableChild {
  id: string;
  name: string;
  className: string;
  grade: string;
  avatarColor: string;
}

interface ChildrenSelectorProps {
  childrenList: SelectableChild[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

/**
 * Horizontal row of ChildChips for switching between a parent's children from
 * the primary screens (home, marks, attendance, quizzes) without opening a menu.
 */
export default function ChildrenSelector({ childrenList, selectedId, onSelect }: ChildrenSelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {childrenList.map(child => (
        <ChildChip
          key={child.id}
          name={child.name}
          className={child.className}
          grade={child.grade}
          avatarColor={child.avatarColor}
          selected={child.id === selectedId}
          onPress={() => onSelect(child.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
});
