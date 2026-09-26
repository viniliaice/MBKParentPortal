import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';

interface TopBarProps {
  title: string;
  onBack?: () => void;
}

/**
 * Pushed-screen header: back button, centered title, and an empty counterweight
 * so the title stays visually centered. Replaces the repeated inline headers.
 */
export default function TopBar({ title, onBack }: TopBarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
  };

  return (
    <View style={[styles.header, { paddingTop: topPad + 12 }]}>
      <Pressable
        onPress={handleBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={[styles.backBtn, { backgroundColor: c.card, borderColor: c.border }]}
      >
        <Ionicons name="arrow-back" size={22} color={c.foreground} />
      </Pressable>
      <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>{title}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '800', flex: 1, textAlign: 'center' },
});
