import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Activity } from '@/data/learningData';
import PressableTile from '@/components/PressableTile';
import ExplorableActivity from '@/components/explorables/ExplorableActivity';

interface Props {
  activity: Activity;
  onCorrect: () => void;
  onIncorrect: () => void;
}

export default function ActivityRenderer({ activity, onCorrect, onIncorrect }: Props) {
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
        : null}

      {submitted && (
        <Animated.View style={[styles.feedback, isCorrect ? styles.feedbackCorrect : styles.feedbackWrong, { opacity: feedbackAnim, transform: [{ scale: feedbackAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
          <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={22} color={isCorrect ? '#2ECC71' : '#FF5370'} />
          <Text style={[styles.feedbackText, { color: isCorrect ? '#2ECC71' : '#FF5370' }]}>
            {isCorrect ? (activity.type === 'explorable' ? 'Nice exploring!' : 'Correct!') : `The answer is: ${activity.correctAnswer}`}
          </Text>
        </Animated.View>
      )}

      {!submitted && activity.hint && activity.type !== 'explorable' ? (
        <HintButton hint={activity.hint} />
      ) : null}
    </View>
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
});
