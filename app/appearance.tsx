import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuroraBackground from '@/components/AuroraBackground';
import TopBar from '@/components/TopBar';
import { useScheme, type AppScheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';

const OPTIONS: { key: AppScheme; label: string; icon: keyof typeof Ionicons.glyphMap; caption: string }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline', caption: 'Bright background, dark text' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline', caption: 'Dark background, light text' },
];

export default function AppearanceScreen() {
  const { scheme, setScheme } = useScheme();
  const c = useColors();

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <TopBar title="Appearance" />
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: Platform.OS === 'web' ? 40 : 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.lead, { color: c.mutedForeground }]}>
            Choose how the parent app looks. Your choice is saved and kept the next time you open the app.
          </Text>

          {OPTIONS.map(opt => {
            const selected = scheme === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setScheme(opt.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: c.card, borderColor: selected ? c.primary : c.border },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: `${c.primary}1F` }]}>
                  <Ionicons name={opt.icon} size={22} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: c.foreground }]}>{opt.label}</Text>
                  <Text style={[styles.caption, { color: c.mutedForeground }]}>{opt.caption}</Text>
                </View>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={selected ? c.primary : c.border}
                />
              </Pressable>
            );
          })}

          <View style={[styles.previewCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.previewTitle, { color: c.foreground }]}>Preview</Text>
            <View style={[styles.previewRow, { backgroundColor: c.muted }]}>
              <View style={[styles.previewAvatar, { backgroundColor: `${c.secondary}33` }]}>
                <Text style={[styles.previewInitial, { color: c.secondary }]}>A</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.previewLine, { backgroundColor: c.mutedForeground, opacity: 0.5 }]} />
                <View style={[styles.previewLineShort, { backgroundColor: c.mutedForeground, opacity: 0.3 }]} />
              </View>
              <View style={[styles.previewPill, { backgroundColor: `${c.accent}22` }]}>
                <Text style={[styles.previewPillText, { color: c.accent }]}>A</Text>
              </View>
            </View>
            <Text style={[styles.previewNote, { color: c.mutedForeground }]}>
              Cards, text and icons all follow this theme.
            </Text>
          </View>
        </ScrollView>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  lead: { fontSize: 14, lineHeight: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
  },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '700' },
  caption: { fontSize: 12, marginTop: 2 },
  previewCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12, marginTop: 8 },
  previewTitle: { fontSize: 13, fontWeight: '700' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  previewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  previewInitial: { fontSize: 16, fontWeight: '800' },
  previewLine: { height: 10, borderRadius: 5, width: '70%', marginBottom: 5 },
  previewLineShort: { height: 8, borderRadius: 4, width: '45%' },
  previewPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  previewPillText: { fontSize: 13, fontWeight: '800' },
  previewNote: { fontSize: 12 },
});
