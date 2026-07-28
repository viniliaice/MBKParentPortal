import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { HotspotExplorerConfig } from '@/data/learningData';

interface Props {
  config: HotspotExplorerConfig;
  submitted: boolean;
  onComplete: (success: boolean) => void;
  accentColor: string;
  /** resolved from config.sceneKey by the caller — the base diagram to overlay hotspots on */
  renderScene: () => React.ReactNode;
}

/**
 * Tap labelled hotspots on a diagram to learn what each part does — a
 * museum "touch the exhibit label" interaction. Positions are 0-100
 * percentages so the same config works at any screen size. Reusable for
 * any labelled-parts diagram in any subject (a cell diagram, a circuit
 * board, a map).
 */
export default function HotspotExplorer({ config, submitted, onComplete, accentColor, renderScene }: Props) {
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);

  const requiredFraction = config.requiredViewFraction ?? 1;
  const requiredCount = Math.ceil(config.hotspots.length * requiredFraction);
  const hasViewedEnough = viewed.size >= requiredCount;

  const openHotspot = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActive(id);
    setViewed(prev => new Set(prev).add(id));
  };

  const handleComplete = () => {
    if (submitted || !hasViewedEnough) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(true);
  };

  const activeHotspot = config.hotspots.find(h => h.id === active);

  return (
    <View style={styles.container}>
      <View style={styles.sceneBox}>
        {renderScene()}
        {config.hotspots.map(h => {
          const isViewed = viewed.has(h.id);
          return (
            <HotspotDot
              key={h.id}
              x={h.x}
              y={h.y}
              icon={h.icon}
              viewed={isViewed}
              color={accentColor}
              onPress={() => openHotspot(h.id)}
            />
          );
        })}
      </View>

      <Text style={styles.progressText}>
        {viewed.size} / {config.hotspots.length} parts explored
      </Text>

      <Modal visible={!!active} transparent animationType="fade" onRequestClose={() => setActive(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActive(null)}>
          <Pressable style={[styles.modalCard, { borderColor: `${accentColor}55` }]}>
            {activeHotspot && (
              <>
                <View style={[styles.modalIcon, { backgroundColor: `${accentColor}22` }]}>
                  <Ionicons name={(activeHotspot.icon ?? 'information-circle') as any} size={22} color={accentColor} />
                </View>
                <Text style={styles.modalTitle}>{activeHotspot.label}</Text>
                <Text style={styles.modalDetail}>{activeHotspot.detail}</Text>
                <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: accentColor }]} onPress={() => setActive(null)}>
                  <Text style={styles.modalCloseBtnText}>Got it</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {!submitted && (
        <TouchableOpacity
          style={[styles.completeBtn, { backgroundColor: hasViewedEnough ? accentColor : 'rgba(255,255,255,0.08)' }]}
          onPress={handleComplete}
          disabled={!hasViewedEnough}
          activeOpacity={0.85}
        >
          <Text style={[styles.completeBtnText, !hasViewedEnough && styles.completeBtnTextDisabled]}>
            {hasViewedEnough ? 'Continue' : `Tap ${requiredCount - viewed.size} more part${requiredCount - viewed.size === 1 ? '' : 's'}`}
          </Text>
          {hasViewedEnough && <Ionicons name="arrow-forward" size={18} color="#04222A" />}
        </TouchableOpacity>
      )}
    </View>
  );
}

function HotspotDot({ x, y, icon, viewed, color, onPress }: {
  x: number; y: number; icon?: string; viewed: boolean; color: string; onPress: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(viewed ? 1 : 1.15, { damping: 8 }) }],
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.hotspotWrap, { left: `${x}%`, top: `${y}%` }]}
    >
      <Animated.View style={[styles.hotspotDot, style, { borderColor: color, backgroundColor: viewed ? `${color}33` : 'rgba(255,255,255,0.15)' }]}>
        <Ionicons name={(icon ?? 'add') as any} size={12} color={viewed ? color : '#FFFFFF'} />
      </Animated.View>
      {!viewed && <View style={[styles.hotspotPulse, { borderColor: color }]} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  sceneBox: {
    minHeight: 180, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
    padding: 16, position: 'relative',
  },
  progressText: { fontSize: 12, color: '#8892B0', textAlign: 'center' },
  hotspotWrap: { position: 'absolute', width: 28, height: 28, marginLeft: -14, marginTop: -14, alignItems: 'center', justifyContent: 'center' },
  hotspotDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  hotspotPulse: { position: 'absolute', width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, opacity: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(4,8,20,0.75)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard: {
    width: '100%', maxWidth: 340, backgroundColor: '#141D3A', borderRadius: 20, padding: 22,
    alignItems: 'center', gap: 10, borderWidth: 1.5,
  },
  modalIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  modalDetail: { fontSize: 14, color: '#CCCCCC', textAlign: 'center', lineHeight: 20 },
  modalCloseBtn: { marginTop: 6, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  modalCloseBtnText: { color: '#04222A', fontWeight: '800', fontSize: 14 },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
  },
  completeBtnText: { color: '#04222A', fontSize: 15, fontWeight: '800' },
  completeBtnTextDisabled: { color: '#4A5080' },
});
