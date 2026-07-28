import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DraggableControl from '@/components/engine/primitives/DraggableControl';
import GaugeMeter from '@/components/engine/primitives/GaugeMeter';
import TemperatureIndicator from '@/components/engine/primitives/TemperatureIndicator';
import type { ParameterExperimentConfig } from '@/data/learningData';

interface Props {
  config: ParameterExperimentConfig;
  submitted: boolean;
  onComplete: (success: boolean) => void;
  accentColor: string;
  /** resolved from config.sceneKey by the caller (e.g. ActivityRenderer's scene registry) */
  renderScene?: (params: Record<string, number>) => React.ReactNode;
  /** resolved from config.narrateKey the same way */
  narrate?: (params: Record<string, number>) => string;
}

/**
 * Generic "drag N variables, watch M live readouts" activity — this is the
 * workhorse of the engine layer. A Physics lesson wires in pressure/height
 * or temperature/compressor-speed; a future Chemistry lesson could wire in
 * temperature/reaction-rate with the exact same component. Nothing here
 * references any specific domain — `renderScene`/`narrate` are resolved by
 * the caller from the config's plain string keys so this file never imports
 * subject-specific illustrations.
 */
export default function ParameterExperiment({ config, submitted, onComplete, accentColor, renderScene, narrate }: Props) {
  const initial = useMemo(() => {
    const values: Record<string, number> = {};
    for (const p of config.parameters) {
      values[p.id] = p.defaultValue ?? p.min;
    }
    return values;
  }, [config.parameters]);

  const [values, setValues] = useState<Record<string, number>>(initial);
  const [maxGoalPct, setMaxGoalPct] = useState(0);

  const goalParam = config.goalParameterId
    ? config.parameters.find(p => p.id === config.goalParameterId)
    : undefined;
  const goalThreshold = config.goalThresholdPct ?? 85;
  const hasReachedGoal = !goalParam || maxGoalPct >= goalThreshold;

  const handleParamChange = useCallback((paramId: string, value: number) => {
    setValues(prev => {
      const next = { ...prev, [paramId]: value };
      if (goalParam && paramId === goalParam.id) {
        const pct = ((value - goalParam.min) / (goalParam.max - goalParam.min)) * 100;
        setMaxGoalPct(m => Math.max(m, pct));
      }
      return next;
    });
  }, [goalParam]);

  const handleComplete = () => {
    if (submitted || !hasReachedGoal) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(true);
  };

  return (
    <View style={styles.container}>
      {renderScene && (
        <View style={styles.sceneBox}>{renderScene(values)}</View>
      )}

      {config.readouts.length > 0 && (
        <View style={styles.readoutRow}>
          {config.readouts.map(r => {
            const source = values[r.sourceParameterId];
            const sourceParam = config.parameters.find(p => p.id === r.sourceParameterId);
            const sourcePct = sourceParam ? (source - sourceParam.min) / (sourceParam.max - sourceParam.min) : 0;
            const effectivePct = r.invert ? 1 - sourcePct : sourcePct;
            const readoutValue = r.toMin + effectivePct * (r.toMax - r.toMin);
            if (r.kind === 'thermometer') {
              return <TemperatureIndicator key={r.id} celsius={readoutValue} min={r.toMin} max={r.toMax} label={r.label} />;
            }
            return <GaugeMeter key={r.id} value={effectivePct * 100} color={r.color} label={r.label} unit={r.unit} />;
          })}
        </View>
      )}

      {narrate && (
        <View style={[styles.narrateBox, { borderColor: `${accentColor}44` }]}>
          <Ionicons name="bulb" size={16} color={accentColor} />
          <Text style={styles.narrateText}>{narrate(values)}</Text>
        </View>
      )}

      <View style={styles.controlsStack}>
        {config.parameters.map(p => (
          <DraggableControl
            key={p.id}
            label={p.label}
            color={p.color ?? accentColor}
            min={p.min}
            max={p.max}
            value={values[p.id]}
            unit={p.unit}
            onChange={(v) => handleParamChange(p.id, v)}
          />
        ))}
      </View>

      {goalParam && !submitted && (
        <View style={styles.goalProgressRow}>
          <View style={styles.goalTrack}>
            <View style={[styles.goalFill, { width: `${Math.min(100, (maxGoalPct / goalThreshold) * 100)}%`, backgroundColor: accentColor }]} />
          </View>
          <Text style={styles.goalLabel}>
            {hasReachedGoal ? 'Goal reached' : `Push ${goalParam.label.toLowerCase()} further`}
          </Text>
        </View>
      )}

      {!submitted && (
        <TouchableOpacity
          style={[styles.completeBtn, { backgroundColor: hasReachedGoal ? accentColor : 'rgba(255,255,255,0.08)' }]}
          onPress={handleComplete}
          disabled={!hasReachedGoal}
          activeOpacity={0.85}
        >
          <Text style={[styles.completeBtnText, !hasReachedGoal && styles.completeBtnTextDisabled]}>
            {hasReachedGoal ? 'Got it!' : 'Keep experimenting'}
          </Text>
          {hasReachedGoal && <Ionicons name="checkmark" size={18} color="#04222A" />}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  sceneBox: {
    minHeight: 150, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  readoutRow: { flexDirection: 'row', justifyContent: 'space-evenly', flexWrap: 'wrap', gap: 12 },
  narrateBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, borderWidth: 1,
  },
  narrateText: { flex: 1, fontSize: 13.5, color: '#E5F9FF', lineHeight: 20 },
  controlsStack: { gap: 18 },
  goalProgressRow: { gap: 6 },
  goalTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  goalFill: { height: 4, borderRadius: 2 },
  goalLabel: { fontSize: 11, color: '#8892B0' },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
  },
  completeBtnText: { color: '#04222A', fontSize: 15, fontWeight: '800' },
  completeBtnTextDisabled: { color: '#4A5080' },
});
