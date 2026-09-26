import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Activity } from '@/data/learningData';
import { withAlpha } from '@/constants/colors';
import { useColors, type Colors } from '@/hooks/useColors';

interface Props {
  activity: Activity;
  onCorrect: () => void;
  onIncorrect: () => void;
}

export default function ActivityRenderer({ activity, onCorrect, onIncorrect }: Props) {
  const c = useColors();
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleResult = (correct: boolean) => {
    setSubmitted(true);
    setIsCorrect(correct);
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCorrect();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      onIncorrect();
    }
  };

  const feedbackAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (submitted) {
      Animated.spring(feedbackAnim, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }).start();
    } else {
      feedbackAnim.setValue(0);
    }
  }, [submitted]);

  const feedbackColor = isCorrect ? c.accent : c.destructive;

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
        : null}

      {submitted && (
        <Animated.View
          style={[
            styles.feedback,
            { backgroundColor: withAlpha(feedbackColor, 0.12), borderColor: withAlpha(feedbackColor, 0.3) },
            { opacity: feedbackAnim, transform: [{ scale: feedbackAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] },
          ]}
        >
          <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={22} color={feedbackColor} />
          <Text style={[styles.feedbackText, { color: feedbackColor }]}>
            {isCorrect ? 'Correct!' : `The answer is: ${activity.correctAnswer}`}
          </Text>
        </Animated.View>
      )}

      {!submitted && activity.hint ? (
        <HintButton hint={activity.hint} />
      ) : null}
    </View>
  );
}

/** The three states a tappable option can be in once feedback is shown. */
function optionPalette(c: Colors, state: 'idle' | 'correct' | 'wrong' | 'selected') {
  switch (state) {
    case 'correct':
      return { backgroundColor: withAlpha(c.accent, 0.16), borderColor: c.accent, color: c.accent };
    case 'wrong':
      return { backgroundColor: withAlpha(c.destructive, 0.16), borderColor: c.destructive, color: c.destructive };
    case 'selected':
      return { backgroundColor: withAlpha(c.primary, 0.16), borderColor: c.primary, color: c.primary };
    default:
      return { backgroundColor: c.surfaceMuted, borderColor: c.border, color: c.foreground };
  }
}

function MultiChoiceActivity({ activity, submitted, onSubmit }: {
  activity: Activity; submitted: boolean; onSubmit: (correct: boolean) => void;
}) {
  const c = useColors();
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
        const state = submitted && opt === activity.correctAnswer ? 'correct'
          : submitted && isSelected ? 'wrong'
          : 'idle';
        const tone = optionPalette(c, state);
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.optionBtn, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}
            onPress={() => tap(opt)}
            activeOpacity={0.7}
          >
            <Text style={[styles.optionText, { color: tone.color }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function FillBlankActivity({ activity, submitted, onSubmit }: {
  activity: Activity; submitted: boolean; onSubmit: (correct: boolean) => void;
}) {
  const c = useColors();
  const [selected, setSelected] = useState<string | null>(null);
  const parts = activity.question.split('___');

  const tap = (opt: string) => {
    if (submitted) return;
    setSelected(opt);
    onSubmit(opt === activity.correctAnswer);
  };

  return (
    <View>
      <View style={[styles.fillSentence, { backgroundColor: c.surfaceMuted }]}>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <Text style={[styles.fillText, { color: c.foreground }]}>{part}</Text>
            {i < parts.length - 1 && (
              <View style={[
                styles.blankBox,
                selected
                  ? { borderColor: c.primary, backgroundColor: withAlpha(c.primary, 0.14) }
                  : { borderColor: c.borderStrong },
              ]}
              >
                <Text style={[styles.blankText, { color: c.primary }]}>{selected || '   ?   '}</Text>
              </View>
            )}
          </React.Fragment>
        ))}
      </View>
      <View style={styles.optionRow}>
        {activity.options.map(opt => {
          const isSelected = selected === opt;
          const state = submitted && opt === activity.correctAnswer ? 'correct'
            : submitted && isSelected ? 'wrong'
            : 'idle';
          const tone = optionPalette(c, state);
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chipBtn, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}
              onPress={() => tap(opt)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, { color: tone.color }]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function DragOrderActivity({ activity, submitted, onSubmit }: {
  activity: Activity; submitted: boolean; onSubmit: (correct: boolean) => void;
}) {
  const c = useColors();
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
      <Text style={[styles.subLabel, { color: c.textSecondary }]}>TAP IN THE CORRECT ORDER</Text>
      <View style={[styles.orderAnswerArea, { borderColor: c.borderStrong }]}>
        {order.length === 0 ? (
          <Text style={[styles.placeholderText, { color: c.textSecondary }]}>Tap items below to add them…</Text>
        ) : (
          <View style={styles.chipRow}>
            {order.map((item, i) => {
              const chipColor = submitted
                ? (item === correct[i] ? c.accent : c.destructive)
                : c.primary;
              return (
                <TouchableOpacity
                  key={`${item}-${i}`}
                  style={[styles.orderChip, { borderColor: chipColor, backgroundColor: withAlpha(chipColor, 0.14) }]}
                  onPress={() => removeItem(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, { color: chipColor }]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
      <View style={styles.chipRow}>
        {remaining.map(item => (
          <TouchableOpacity
            key={item}
            style={[styles.chipBtn, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
            onPress={() => addItem(item)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: c.foreground }]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function MatchPairsActivity({ activity, submitted, onSubmit }: {
  activity: Activity; submitted: boolean; onSubmit: (correct: boolean) => void;
}) {
  const c = useColors();
  const pairs = activity.pairs ?? [];
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [wrong, setWrong] = useState<string[]>([]);

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
      setTimeout(() => { setWrong([]); setSelectedLeft(null); }, 700);
    }
  };

  const leftItems = pairs.map(p => p.left);

  const chipTone = (isMatched: boolean, isSelected: boolean, isWrong: boolean) => {
    if (isMatched) return { borderColor: c.accent, backgroundColor: withAlpha(c.accent, 0.14), icon: c.accent };
    if (isWrong) return { borderColor: c.destructive, backgroundColor: withAlpha(c.destructive, 0.14), icon: c.destructive };
    if (isSelected) return { borderColor: c.primary, backgroundColor: withAlpha(c.primary, 0.16), icon: c.primary };
    return { borderColor: c.border, backgroundColor: c.surfaceMuted, icon: c.accent };
  };

  return (
    <View>
      <Text style={[styles.subLabel, { color: c.textSecondary }]}>TAP TO MATCH</Text>
      <View style={styles.matchGrid}>
        <View style={styles.matchCol}>
          {leftItems.map(item => {
            const tone = chipTone(!!matched[item], selectedLeft === item, wrong.includes(item));
            return (
              <TouchableOpacity
                key={item}
                style={[styles.matchChip, { borderColor: tone.borderColor, backgroundColor: tone.backgroundColor }]}
                onPress={() => tapLeft(item)}
                activeOpacity={0.7}
              >
                <Text style={[styles.matchText, { color: c.foreground }]}>{item}</Text>
                {matched[item] ? <Ionicons name="checkmark" size={14} color={c.accent} style={{ marginLeft: 4 }} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={[styles.matchDivider, { backgroundColor: c.borderStrong }]} />
        <View style={styles.matchCol}>
          {rightOptions.map(item => {
            const isMatched = Object.values(matched).includes(item);
            const tone = chipTone(isMatched, !!selectedLeft && !isMatched, wrong.includes(item));
            return (
              <TouchableOpacity
                key={item}
                style={[styles.matchChip, { borderColor: tone.borderColor, backgroundColor: tone.backgroundColor }]}
                onPress={() => tapRight(item)}
                activeOpacity={0.7}
              >
                <Text style={[styles.matchText, { color: c.foreground }]}>{item}</Text>
                {isMatched ? <Ionicons name="checkmark" size={14} color={c.accent} style={{ marginLeft: 4 }} /> : null}
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
  const c = useColors();
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
      <Text style={[styles.subLabel, { color: c.textSecondary }]}>TAP THE CORRECT NUMBER</Text>
      <View style={styles.numberLineContainer}>
        <View style={[styles.numberLineTrack, { backgroundColor: c.borderStrong }]} />
        <View style={styles.numberLineNumbers}>
          {numbers.map(n => {
            let state: 'idle' | 'correct' | 'wrong' | 'selected' = 'idle';
            if (selected === n) {
              state = submitted ? (n === target ? 'correct' : 'wrong') : 'selected';
            } else if (submitted && n === target) {
              state = 'correct';
            }
            const tone = optionPalette(c, state);
            return (
              <TouchableOpacity
                key={n}
                style={[styles.numberNode, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}
                onPress={() => tap(n)}
                activeOpacity={0.7}
              >
                <Text style={[styles.numberText, { color: tone.color }]}>{n}</Text>
              </TouchableOpacity>
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
  const c = useColors();
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
        const isRight = opt === activity.correctAnswer;
        const state = submitted && isRight ? 'correct'
          : submitted && isSelected ? 'wrong'
          : 'idle';
        const tone = optionPalette(c, state);
        const icon = submitted ? (isRight ? 'checkmark-circle' : isSelected ? 'close-circle' : null) : null;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.tfBtn, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}
            onPress={() => tap(opt)}
            activeOpacity={0.7}
          >
            {icon ? <Ionicons name={icon} size={20} color={isRight ? c.accent : c.destructive} /> : null}
            <Text style={[styles.tfBtnText, { color: tone.color }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function WritingActivity({ activity, submitted, onSubmit }: {
  activity: Activity; submitted: boolean; onSubmit: (correct: boolean) => void;
}) {
  const c = useColors();
  const [selected, setSelected] = useState<string | null>(null);
  const tap = (opt: string) => {
    if (submitted) return;
    setSelected(opt);
    onSubmit(opt === activity.correctAnswer);
  };
  return (
    <View>
      <Text style={[styles.subLabel, { color: c.textSecondary }]}>SELECT THE CORRECT SPELLING</Text>
      <View style={styles.optionGrid}>
        {activity.options.map(opt => {
          const isSelected = selected === opt;
          const state = submitted && opt === activity.correctAnswer ? 'correct'
            : submitted && isSelected ? 'wrong'
            : 'idle';
          const tone = optionPalette(c, state);
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.optionBtn, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}
              onPress={() => tap(opt)}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionText, { color: tone.color, fontFamily: 'monospace', fontSize: 17 }]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function HintButton({ hint }: { hint: string }) {
  const c = useColors();
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginTop: 12 }}>
      {!show ? (
        <TouchableOpacity style={styles.hintBtn} onPress={() => setShow(true)} activeOpacity={0.7}>
          <Ionicons name="bulb-outline" size={16} color={c.warning} />
          <Text style={[styles.hintBtnText, { color: c.warning }]}>Need a hint?</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.hintBox, { backgroundColor: withAlpha(c.warning, 0.1), borderColor: withAlpha(c.warning, 0.25) }]}>
          <Ionicons name="bulb" size={16} color={c.warning} />
          <Text style={[styles.hintText, { color: c.warning }]}>{hint}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  subLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionBtn: { flex: 1, minWidth: '45%', paddingVertical: 16, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  chipBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, borderWidth: 1.5 },
  chipText: { fontSize: 14, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fillSentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4, borderRadius: 14, padding: 14 },
  fillText: { fontSize: 16 },
  blankBox: { borderBottomWidth: 2, paddingHorizontal: 12, paddingVertical: 2, minWidth: 60, alignItems: 'center' },
  blankText: { fontSize: 16, fontWeight: '700' },
  orderAnswerArea: { borderWidth: 1.5, borderRadius: 14, padding: 14, minHeight: 56, marginBottom: 14, justifyContent: 'center' },
  orderChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5 },
  placeholderText: { fontSize: 14, textAlign: 'center' },
  matchGrid: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  matchCol: { flex: 1, gap: 8 },
  matchDivider: { width: 1, alignSelf: 'stretch' },
  matchChip: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  matchText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  numberLineContainer: { paddingVertical: 16, position: 'relative' },
  numberLineTrack: { height: 2, position: 'absolute', left: 16, right: 16, top: '50%' },
  numberLineNumbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  numberNode: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 15, fontWeight: '700' },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  feedbackText: { fontSize: 14, fontWeight: '600', flex: 1 },
  tfContainer: { flexDirection: 'row', gap: 12 },
  tfBtn: { flex: 1, paddingVertical: 20, paddingHorizontal: 16, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  tfBtnText: { fontSize: 18, fontWeight: '800' },
  hintBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintBtnText: { fontSize: 13 },
  hintBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, padding: 12, borderWidth: 1 },
  hintText: { fontSize: 13, flex: 1 },
});
