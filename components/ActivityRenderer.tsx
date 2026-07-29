import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Activity } from '@/data/learningData';
import PressableTile from '@/components/PressableTile';
import ExplorableActivity from '@/components/explorables/ExplorableActivity';
import ParameterExperiment from '@/components/engine/ParameterExperiment';
import PhysicsSandbox from '@/components/engine/PhysicsSandbox';
import CauseEffectExplorer from '@/components/engine/CauseEffectExplorer';
import BuildChallenge from '@/components/engine/BuildChallenge';
import GuidedDiscovery from '@/components/engine/GuidedDiscovery';
import HotspotExplorer from '@/components/engine/HotspotExplorer';
import PredictionChallenge from '@/components/engine/PredictionChallenge';
import EngineDragMechanism from '@/components/engine/DragMechanism';
import SuccessCelebration from '@/components/engine/primitives/SuccessCelebration';
import {
  sceneRegistry, parameterSceneRegistry, describeRegistry, narrateRegistry,
  sandboxModelRegistry, sandboxSceneRegistry, sandboxNarrateRegistry,
} from '@/components/lessonContent/activityRegistry';
import { isExploreType } from '@/constants/activityTypes';
import { playSound } from '@/lib/audio/soundEngine';

/*
 * ---------------------------------------------------------------------
 * Premium interactive activity engine — kind -> component mapping.
 *
 * The mission brief asked for 15 named activity types (interactiveSimulation,
 * interactiveDiagram, parameterExperiment, buildChallenge, causeEffectExplorer,
 * systemBuilder, physicsPlayground, animatedProcess, guidedDiscovery,
 * predictionChallenge, interactiveTimeline, hotspotExplorer, measurementTool,
 * dragMechanism, flowSimulation). Several of those names describe the exact
 * same underlying interaction shape, so rather than building 15 near-duplicate
 * components, each name resolves to one of 7 real reusable components below:
 *
 *   parameterExperiment, interactiveSimulation,
 *   measurementTool          -> ParameterExperiment  (drag N vars, watch M linearly-derived readouts)
 *   physicsPlayground        -> PhysicsSandbox        (drag N vars into a REAL continuous simulation loop —
 *                                                       every variable can influence every other one through
 *                                                       the model's own physics, not a fixed linear mapping)
 *   causeEffectExplorer, animatedProcess,
 *   interactiveTimeline, flowSimulation
 *                            -> CauseEffectExplorer   (press trigger, watch staged sequence)
 *   buildChallenge, systemBuilder
 *                            -> BuildChallenge        (select minimal correct part set)
 *   guidedDiscovery          -> GuidedDiscovery       (tap-to-reveal fact cards)
 *   hotspotExplorer,
 *   interactiveDiagram       -> HotspotExplorer       (tap labelled diagram hotspots)
 *   predictionChallenge      -> PredictionChallenge   (commit to a guess, then reveal)
 *   dragMechanism            -> EngineDragMechanism   (drag one part along a track)
 *
 * All 15 names remain distinct entries in data/learningData.ts's ActivityType
 * union and are still individually selectable per-activity in curriculum
 * content; this file is simply where the reuse happens, exactly as
 * AGENTS.md's "check every switch on activity type" warning anticipates.
 * ---------------------------------------------------------------------
 */

const PARAMETER_EXPERIMENT_TYPES = new Set(['parameterExperiment', 'interactiveSimulation', 'measurementTool']);
const CAUSE_EFFECT_TYPES = new Set(['causeEffectExplorer', 'animatedProcess', 'interactiveTimeline', 'flowSimulation']);
const BUILD_TYPES = new Set(['buildChallenge', 'systemBuilder']);
const HOTSPOT_TYPES = new Set(['hotspotExplorer', 'interactiveDiagram']);

interface Props {
  activity: Activity;
  onCorrect: () => void;
  onIncorrect: () => void;
  /** used by the engine activity types for their primary accent color; falls back to a neutral cyan. */
  accentColor?: string;
}

export default function ActivityRenderer({ activity, onCorrect, onIncorrect, accentColor = '#22D3EE' }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [dragMechanismInteracted, setDragMechanismInteracted] = useState(false);
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);

  const handleResult = (correct: boolean) => {
    setSubmitted(true);
    setIsCorrect(correct);
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSound('successChime');
      setCelebrationTrigger(n => n + 1);
      onCorrect();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playSound('mistakeBuzz');
      onIncorrect();
    }
  };

  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (submitted) {
      Animated.spring(feedbackAnim, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }).start();
      if (!isCorrect) {
        shakeAnim.setValue(0);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0.6, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
        ]).start();
      }
    } else {
      feedbackAnim.setValue(0);
    }
  }, [submitted]);

  const isEngineNoAnswerType = isExploreType(activity.type);

  return (
    <View style={styles.container}>
      {activity.type === 'multipleChoice' || activity.type === 'tapCorrect'
        ? <MultiChoiceActivity activity={activity} submitted={submitted} onSubmit={handleResult} />
        : activity.type === 'fillBlank'
        ? <FillBlankActivity activity={activity} submitted={submitted} onSubmit={handleResult} />
        : activity.type === 'dragOrder'
        ? <DragOrderActivity activity={activity} submitted={submitted} onSubmit={handleResult} />
        : activity.type === 'matchPairs'
        ? <MatchPairsActivity activity={activity} submitted={submitted} onSubmit={handleResult} />
        : activity.type === 'numberLine'
        ? <NumberLineActivity activity={activity} submitted={submitted} onSubmit={handleResult} />
        : activity.type === 'trueFalse'
        ? <TrueFalseActivity activity={activity} submitted={submitted} onSubmit={handleResult} />
        : activity.type === 'writing'
        ? <WritingActivity activity={activity} submitted={submitted} onSubmit={handleResult} />
        : activity.type === 'explorable'
        ? <ExplorableActivity activity={activity} submitted={submitted} onSubmit={handleResult} />
        : PARAMETER_EXPERIMENT_TYPES.has(activity.type) && activity.parameterExperimentConfig
        ? (
          <ParameterExperiment
            config={activity.parameterExperimentConfig}
            submitted={submitted}
            onComplete={handleResult}
            accentColor={accentColor}
            renderScene={activity.parameterExperimentConfig.sceneKey
              ? (params) => parameterSceneRegistry[activity.parameterExperimentConfig!.sceneKey!]?.(params, accentColor)
              : undefined}
            narrate={activity.parameterExperimentConfig.narrateKey
              ? (params) => narrateRegistry[activity.parameterExperimentConfig!.narrateKey!]?.(params) ?? ''
              : undefined}
          />
        )
        : activity.type === 'physicsPlayground' && activity.physicsSandboxConfig
        ? (
          <PhysicsSandbox
            config={activity.physicsSandboxConfig}
            submitted={submitted}
            onComplete={handleResult}
            accentColor={accentColor}
            model={sandboxModelRegistry[activity.physicsSandboxConfig.modelKey]}
            renderScene={(state) => sandboxSceneRegistry[activity.physicsSandboxConfig!.sceneKey]?.(state, accentColor)}
            computeReadout={(state, readoutId) => {
              const s = state as Record<string, number>;
              // Sandbox readouts read directly off named fields of the
              // model's state object (tankPressure, inflowRate, etc.) by
              // id — the id in data/learningData.ts's PhysicsSandboxReadout
              // is the state field name itself, keeping the mapping
              // declarative without a second per-lesson lookup table.
              return typeof s[readoutId] === 'number' ? (s[readoutId] as number) : 0;
            }}
            narrate={activity.physicsSandboxConfig.narrateKey
              ? (state, inputs) => sandboxNarrateRegistry[activity.physicsSandboxConfig!.narrateKey!]?.(state as any, inputs) ?? ''
              : undefined}
          />
        )
        : CAUSE_EFFECT_TYPES.has(activity.type) && activity.causeEffectConfig
        ? (
          <CauseEffectExplorer
            config={activity.causeEffectConfig}
            submitted={submitted}
            onComplete={handleResult}
            accentColor={accentColor}
            renderScene={(sceneProgress) => sceneRegistry[activity.causeEffectConfig!.sceneKey]?.(sceneProgress, accentColor)}
          />
        )
        : BUILD_TYPES.has(activity.type) && activity.buildChallengeConfig
        ? <BuildChallenge config={activity.buildChallengeConfig} submitted={submitted} onComplete={handleResult} accentColor={accentColor} />
        : activity.type === 'guidedDiscovery' && activity.guidedDiscoveryConfig
        ? <GuidedDiscovery config={activity.guidedDiscoveryConfig} submitted={submitted} onComplete={handleResult} accentColor={accentColor} />
        : HOTSPOT_TYPES.has(activity.type) && activity.hotspotConfig
        ? (
          <HotspotExplorer
            config={activity.hotspotConfig}
            submitted={submitted}
            onComplete={handleResult}
            accentColor={accentColor}
            renderScene={() => sceneRegistry[activity.hotspotConfig!.sceneKey]?.(100, accentColor)}
          />
        )
        : activity.type === 'predictionChallenge' && activity.predictionConfig
        ? (
          <PredictionChallenge
            config={activity.predictionConfig}
            submitted={submitted}
            onComplete={handleResult}
            accentColor={accentColor}
            renderScene={activity.predictionConfig.sceneKey
              ? () => sceneRegistry[activity.predictionConfig!.sceneKey!]?.(100, accentColor)
              : undefined}
          />
        )
        : activity.type === 'dragMechanism' && activity.dragMechanismConfig
        ? (
          <EngineDragMechanism
            config={activity.dragMechanismConfig}
            color={accentColor}
            describe={describeRegistry[activity.dragMechanismConfig.describeKey] ?? (() => '')}
            onPositionChange={() => { if (!dragMechanismInteracted) setDragMechanismInteracted(true); }}
          />
        )
        : null}

      {activity.type === 'dragMechanism' && !submitted && (
        <DragMechanismCompleteButton
          onComplete={() => handleResult(true)}
          accentColor={accentColor}
          enabled={dragMechanismInteracted}
        />
      )}

      {submitted && (
        <Animated.View
          style={[
            styles.feedback,
            isCorrect ? styles.feedbackCorrect : styles.feedbackWrong,
            {
              opacity: feedbackAnim,
              transform: [
                { scale: feedbackAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                { translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) },
              ],
            },
          ]}
        >
          {isCorrect ? (
            <SuccessCelebration trigger={celebrationTrigger} size={22} />
          ) : (
            <Ionicons name="close-circle" size={22} color="#FF5370" />
          )}
          <Text style={[styles.feedbackText, { color: isCorrect ? '#2ECC71' : '#FF5370' }]}>
            {isCorrect ? (isEngineNoAnswerType ? 'Nice exploring!' : 'Correct!') : `The answer is: ${activity.correctAnswer}`}
          </Text>
        </Animated.View>
      )}

      {!submitted && activity.hint && !isEngineNoAnswerType ? (
        <HintButton hint={activity.hint} />
      ) : null}
    </View>
  );
}

function DragMechanismCompleteButton({ onComplete, accentColor, enabled }: { onComplete: () => void; accentColor: string; enabled: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.dragMechCompleteBtn, { backgroundColor: enabled ? accentColor : 'rgba(255,255,255,0.08)' }]}
      onPress={onComplete}
      disabled={!enabled}
      activeOpacity={0.85}
    >
      <Text style={[styles.dragMechCompleteBtnText, !enabled && styles.dragMechCompleteBtnTextDisabled]}>
        {enabled ? 'Got it!' : 'Drag the part first'}
      </Text>
      {enabled && <Ionicons name="checkmark" size={18} color="#04222A" />}
    </TouchableOpacity>
  );
}

function MultiChoiceActivity({ activity, submitted, onSubmit }: {
  activity: Activity; submitted: boolean; onSubmit: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const tap = (opt: string) => {
    if (submitted) return;
    setSelected(opt);
    onSubmit(opt === activity.correctAnswer);
  };

  return (
    <View style={styles.optionGrid}>
      {activity.options.map(opt => {
        const isSelected = selected === opt;
        const correct = activity.correctAnswer;
        let bg = 'rgba(255,255,255,0.06)';
        let border = 'rgba(255,255,255,0.12)';
        if (submitted && opt === correct) { bg = 'rgba(46,204,113,0.18)'; border = '#2ECC71'; }
        else if (submitted && isSelected && opt !== correct) { bg = 'rgba(255,83,112,0.18)'; border = '#FF5370'; }
        return (
          <PressableTile
            key={opt}
            style={[styles.optionBtn, { backgroundColor: bg, borderColor: border }]}
            onPress={() => tap(opt)}
            disabled={submitted}
          >
            <Text style={styles.optionText}>{opt}</Text>
          </PressableTile>
        );
      })}
    </View>
  );
}

function FillBlankActivity({ activity, submitted, onSubmit }: {
  activity: Activity; submitted: boolean; onSubmit: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const parts = activity.question.split('___');

  const tap = (opt: string) => {
    if (submitted) return;
    setSelected(opt);
    onSubmit(opt === activity.correctAnswer);
  };

  return (
    <View>
      <View style={styles.fillSentence}>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <Text style={styles.fillText}>{part}</Text>
            {i < parts.length - 1 && (
              <View style={[styles.blankBox, selected && { borderColor: '#3D5AFE', backgroundColor: 'rgba(61,90,254,0.15)' }]}>
                <Text style={styles.blankText}>{selected || '   ?   '}</Text>
              </View>
            )}
          </React.Fragment>
        ))}
      </View>
      <View style={styles.optionRow}>
        {activity.options.map(opt => {
          const isSelected = selected === opt;
          const correct = activity.correctAnswer;
          let bg = 'rgba(255,255,255,0.06)';
          let border = 'rgba(255,255,255,0.12)';
          if (submitted && opt === correct) { bg = 'rgba(46,204,113,0.18)'; border = '#2ECC71'; }
          else if (submitted && isSelected && opt !== correct) { bg = 'rgba(255,83,112,0.18)'; border = '#FF5370'; }
          return (
            <PressableTile
              key={opt}
              style={[styles.chipBtn, { backgroundColor: bg, borderColor: border }]}
              onPress={() => tap(opt)}
              disabled={submitted}
            >
              <Text style={styles.chipText}>{opt}</Text>
            </PressableTile>
          );
        })}
      </View>
    </View>
  );
}

function DragOrderActivity({ activity, submitted, onSubmit }: {
  activity: Activity; submitted: boolean; onSubmit: (correct: boolean) => void;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<string[]>([...activity.options]);
  const correct = activity.correctAnswer.split(',');

  const addItem = (item: string) => {
    if (submitted) return;
    const newOrder = [...order, item];
    const newRemaining = remaining.filter(r => r !== item);
    setOrder(newOrder);
    setRemaining(newRemaining);
    if (newOrder.length === activity.options.length) {
      onSubmit(newOrder.join(',') === activity.correctAnswer);
    }
  };

  const removeItem = (item: string) => {
    if (submitted) return;
    setOrder(prev => prev.filter(i => i !== item));
    setRemaining(prev => [...prev, item]);
  };

  return (
    <View>
      <Text style={styles.subLabel}>TAP IN THE CORRECT ORDER</Text>
      <View style={styles.orderAnswerArea}>
        {order.length === 0 ? (
          <Text style={styles.placeholderText}>Tap items below to add them…</Text>
        ) : (
          <View style={styles.chipRow}>
            {order.map((item, i) => {
              let chipColor = '#3D5AFE';
              if (submitted) {
                chipColor = item === correct[i] ? '#2ECC71' : '#FF5370';
              }
              return (
                <TouchableOpacity key={`${item}-${i}`} style={[styles.orderChip, { borderColor: chipColor, backgroundColor: `${chipColor}22` }]} onPress={() => removeItem(item)} activeOpacity={0.7}>
                  <Text style={[styles.chipText, { color: chipColor }]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
      <View style={styles.chipRow}>
        {remaining.map(item => (
          <TouchableOpacity key={item} style={styles.chipBtn} onPress={() => addItem(item)} activeOpacity={0.7}>
            <Text style={styles.chipText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function MatchPairsActivity({ activity, submitted, onSubmit }: {
  activity: Activity; submitted: boolean; onSubmit: (correct: boolean) => void;
}) {
  const pairs = activity.pairs ?? [];
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [wrong, setWrong] = useState<string[]>([]);
  const wrongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (wrongTimeoutRef.current) clearTimeout(wrongTimeoutRef.current);
    };
  }, []);

  const [rightOptions] = useState(() => {
    const arr = pairs.map(p => p.right);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  const tapLeft = (item: string) => {
    if (submitted || matched[item]) return;
    setSelectedLeft(item);
  };

  const tapRight = (item: string) => {
    if (submitted || !selectedLeft) return;
    const correctRight = pairs.find(p => p.left === selectedLeft)?.right;
    if (item === correctRight) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newMatched = { ...matched, [selectedLeft]: item };
      setMatched(newMatched);
      setSelectedLeft(null);
      if (Object.keys(newMatched).length === pairs.length) {
        onSubmit(true);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setWrong([selectedLeft, item]);
      wrongTimeoutRef.current = setTimeout(() => { setWrong([]); setSelectedLeft(null); }, 700);
    }
  };

  const leftItems = pairs.map(p => p.left);

  return (
    <View>
      <Text style={styles.subLabel}>TAP TO MATCH</Text>
      <View style={styles.matchGrid}>
        <View style={styles.matchCol}>
          {leftItems.map(item => {
            const isMatched = !!matched[item];
            const isSelected = selectedLeft === item;
            const isWrong = wrong.includes(item);
            return (
              <TouchableOpacity
                key={item}
                style={[styles.matchChip,
                  isMatched && { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.15)' },
                  isSelected && { borderColor: '#3D5AFE', backgroundColor: 'rgba(61,90,254,0.2)' },
                  isWrong && { borderColor: '#FF5370', backgroundColor: 'rgba(255,83,112,0.15)' },
                ]}
                onPress={() => tapLeft(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.matchText}>{item}</Text>
                {isMatched && <Ionicons name="checkmark" size={14} color="#2ECC71" style={{ marginLeft: 4 }} />}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.matchDivider} />
        <View style={styles.matchCol}>
          {rightOptions.map(item => {
            const isMatched = Object.values(matched).includes(item);
            const isWrong = wrong.includes(item);
            return (
              <TouchableOpacity
                key={item}
                style={[styles.matchChip,
                  isMatched && { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.15)' },
                  isWrong && { borderColor: '#FF5370', backgroundColor: 'rgba(255,83,112,0.15)' },
                  selectedLeft && !isMatched && { borderColor: '#3D5AFE' },
                ]}
                onPress={() => tapRight(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.matchText}>{item}</Text>
                {isMatched && <Ionicons name="checkmark" size={14} color="#2ECC71" style={{ marginLeft: 4 }} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function NumberLineActivity({ activity, submitted, onSubmit }: {
  activity: Activity; submitted: boolean; onSubmit: (correct: boolean) => void;
}) {
  const min = activity.min ?? 0;
  const max = activity.max ?? 10;
  const [selected, setSelected] = useState<number | null>(null);
  const target = parseInt(activity.correctAnswer, 10);
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const tap = (n: number) => {
    if (submitted) return;
    setSelected(n);
    onSubmit(n === target);
  };

  return (
    <View>
      <Text style={styles.subLabel}>TAP THE CORRECT NUMBER</Text>
      <View style={styles.numberLineContainer}>
        <View style={styles.numberLineTrack} />
        <View style={styles.numberLineNumbers}>
          {numbers.map(n => {
            let bg = 'rgba(255,255,255,0.06)';
            let textColor = '#8892B0';
            let borderColor = 'rgba(255,255,255,0.12)';
            if (selected === n) {
              if (submitted) {
                bg = n === target ? 'rgba(46,204,113,0.3)' : 'rgba(255,83,112,0.3)';
                borderColor = n === target ? '#2ECC71' : '#FF5370';
                textColor = n === target ? '#2ECC71' : '#FF5370';
              } else {
                bg = 'rgba(61,90,254,0.3)';
                borderColor = '#3D5AFE';
                textColor = '#FFFFFF';
              }
            } else if (submitted && n === target) {
              bg = 'rgba(46,204,113,0.2)';
              borderColor = '#2ECC71';
              textColor = '#2ECC71';
            }
            return (
              <PressableTile
                key={n}
                style={[styles.numberNode, { backgroundColor: bg, borderColor }]}
                onPress={() => tap(n)}
                disabled={submitted}
              >
                <Text style={[styles.numberText, { color: textColor }]}>{n}</Text>
              </PressableTile>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function TrueFalseActivity({ activity, submitted, onSubmit }: {
  activity: Activity; submitted: boolean; onSubmit: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const tap = (opt: string) => {
    if (submitted) return;
    setSelected(opt);
    onSubmit(opt === activity.correctAnswer);
  };
  return (
    <View style={styles.tfContainer}>
      {['True', 'False'].map(opt => {
        const isSelected = selected === opt;
        const correct = activity.correctAnswer;
        let bg = 'rgba(255,255,255,0.06)';
        let border = 'rgba(255,255,255,0.12)';
        let icon: any = null;
        if (submitted && opt === correct) { bg = 'rgba(46,204,113,0.18)'; border = '#2ECC71'; icon = 'checkmark-circle'; }
        else if (submitted && isSelected && opt !== correct) { bg = 'rgba(255,83,112,0.18)'; border = '#FF5370'; icon = 'close-circle'; }
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.tfBtn, { backgroundColor: bg, borderColor: border }]}
            onPress={() => tap(opt)}
            activeOpacity={0.7}
          >
            {icon && <Ionicons name={icon} size={20} color={submitted && opt === correct ? '#2ECC71' : '#FF5370'} />}
            <Text style={styles.tfBtnText}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function WritingActivity({ activity, submitted, onSubmit }: {
  activity: Activity; submitted: boolean; onSubmit: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const tap = (opt: string) => {
    if (submitted) return;
    setSelected(opt);
    onSubmit(opt === activity.correctAnswer);
  };
  return (
    <View>
      <Text style={styles.subLabel}>SELECT THE CORRECT SPELLING</Text>
      <View style={styles.optionGrid}>
        {activity.options.map(opt => {
          const isSelected = selected === opt;
          const correct = activity.correctAnswer;
          let bg = 'rgba(255,255,255,0.06)';
          let border = 'rgba(255,255,255,0.12)';
          if (submitted && opt === correct) { bg = 'rgba(46,204,113,0.18)'; border = '#2ECC71'; }
          else if (submitted && isSelected && opt !== correct) { bg = 'rgba(255,83,112,0.18)'; border = '#FF5370'; }
          return (
            <PressableTile
              key={opt}
              style={[styles.optionBtn, { backgroundColor: bg, borderColor: border }]}
              onPress={() => tap(opt)}
              disabled={submitted}
            >
              <Text style={[styles.optionText, { fontFamily: 'monospace', fontSize: 17 }]}>{opt}</Text>
            </PressableTile>
          );
        })}
      </View>
    </View>
  );
}

function HintButton({ hint }: { hint: string }) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginTop: 12 }}>
      {!show ? (
        <TouchableOpacity style={styles.hintBtn} onPress={() => setShow(true)} activeOpacity={0.7}>
          <Ionicons name="bulb-outline" size={16} color="#F59E0B" />
          <Text style={styles.hintBtnText}>Need a hint?</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.hintBox}>
          <Ionicons name="bulb" size={16} color="#F59E0B" />
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  subLabel: { fontSize: 11, fontWeight: '600', color: '#8892B0', letterSpacing: 1, marginBottom: 8 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionBtn: { flex: 1, minWidth: '45%', paddingVertical: 16, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  optionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  chipBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' },
  chipText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fillSentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14 },
  fillText: { color: '#FFFFFF', fontSize: 16 },
  blankBox: { borderBottomWidth: 2, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 12, paddingVertical: 2, minWidth: 60, alignItems: 'center' },
  blankText: { color: '#3D5AFE', fontSize: 16, fontWeight: '700' },
  orderAnswerArea: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14, minHeight: 56, marginBottom: 14, justifyContent: 'center' },
  orderChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5 },
  placeholderText: { color: '#8892B0', fontSize: 14, textAlign: 'center' },
  matchGrid: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  matchCol: { flex: 1, gap: 8 },
  matchDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'stretch' },
  matchChip: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  matchText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  numberLineContainer: { paddingVertical: 16, position: 'relative' },
  numberLineTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.12)', position: 'absolute', left: 16, right: 16, top: '50%' },
  numberLineNumbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  numberNode: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 15, fontWeight: '700' },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  feedbackCorrect: { backgroundColor: 'rgba(46,204,113,0.12)', borderColor: 'rgba(46,204,113,0.3)' },
  feedbackWrong: { backgroundColor: 'rgba(255,83,112,0.12)', borderColor: 'rgba(255,83,112,0.3)' },
  feedbackText: { fontSize: 14, fontWeight: '600', flex: 1 },
  tfContainer: { flexDirection: 'row', gap: 12 },
  tfBtn: { flex: 1, paddingVertical: 20, paddingHorizontal: 16, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  tfBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  hintBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintBtnText: { color: '#F59E0B', fontSize: 13 },
  hintBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  hintText: { color: '#FCD34D', fontSize: 13, flex: 1 },
  dragMechCompleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, marginTop: 4,
  },
  dragMechCompleteBtnText: { color: '#04222A', fontSize: 15, fontWeight: '800' },
  dragMechCompleteBtnTextDisabled: { color: '#4A5080' },
});
