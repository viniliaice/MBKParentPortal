import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  topicId: string;
  topicColor: string;
  onComplete: () => void;
}

function useSpringAnim(delay = 0): Animated.Value {
  const val = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(val, { toValue: 1, friction: 5, tension: 60, delay, useNativeDriver: true }).start();
  }, []);
  return val;
}

function AnimatedDot({ index, color }: { index: number; color: string }) {
  const anim = useSpringAnim(index * 300);
  const numAnim = useSpringAnim(index * 300 + 150);
  const [showNum, setShowNum] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShowNum(true), index * 300 + 150); return () => clearTimeout(t); }, []);

  return (
    <Animated.View style={{ alignItems: 'center', gap: 4, opacity: anim, transform: [{ scale: anim }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
      <View style={[styles.dot, { width: 36, height: 36, borderRadius: 18, backgroundColor: color, opacity: 0.85 }]} />
      {showNum && (
        <Animated.Text style={[styles.dotNum, { opacity: numAnim, transform: [{ scale: numAnim }] }]}>
          {index + 1}
        </Animated.Text>
      )}
    </Animated.View>
  );
}

function CountingAnimation({ color }: { color: string }) {
  const count = 5;
  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>Let's Count!</Text>
      <View style={styles.dotsRow}>
        {Array.from({ length: count }, (_, i) => (
          <AnimatedDot key={i} index={i} color={color} />
        ))}
      </View>
      <Text style={styles.animHint}>Tap each item and say the number</Text>
    </View>
  );
}

function AdditionAnimation({ color }: { color: string }) {
  const group1 = useSpringAnim(200);
  const plusAnim = useSpringAnim(1200);
  const group2 = useSpringAnim(600);
  const eqAnim = useSpringAnim(1600);
  const resultAnim = useSpringAnim(2000);

  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>Addition = Putting Together</Text>
      <View style={styles.addRow}>
        <Animated.View style={{ flexDirection: 'row', gap: 4, opacity: group1, transform: [{ scale: group1 }, { translateX: group1.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
          {['🍎', '🍎'].map((e, i) => <Text key={i} style={styles.addEmoji}>{e}</Text>)}
        </Animated.View>
        <Animated.Text style={[styles.operator, { opacity: plusAnim, transform: [{ scale: plusAnim }] }]}>+</Animated.Text>
        <Animated.View style={{ flexDirection: 'row', gap: 4, opacity: group2, transform: [{ scale: group2 }, { translateX: group2.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
          {['🍎', '🍎', '🍎'].map((e, i) => <Text key={i} style={styles.addEmoji}>{e}</Text>)}
        </Animated.View>
        <Animated.Text style={[styles.operator, { opacity: eqAnim, transform: [{ scale: eqAnim }] }]}>=</Animated.Text>
        <Animated.View style={[styles.resultCircle, { backgroundColor: `${color}33` }, { opacity: resultAnim, transform: [{ scale: resultAnim }] }]}>
          <Text style={[styles.resultNum, { color }]}>5</Text>
        </Animated.View>
      </View>
      <Text style={styles.animHint}>2 + 3 = 5 — groups join together!</Text>
    </View>
  );
}

function SubCookie({ index, takenAway }: { index: number; takenAway: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 200, useNativeDriver: true }).start();
    if (takenAway) {
      Animated.sequence([
        Animated.delay(index * 200 + 1000),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 60, duration: 500, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Text style={styles.addEmoji}>🍪</Text>
    </Animated.View>
  );
}

function SubtractionAnimation({ color }: { color: string }) {
  const total = 5;
  const takenAwayCount = 3;
  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>Subtraction = Taking Away</Text>
      <View style={styles.subRow}>
        {Array.from({ length: total }, (_, i) => (
          <SubCookie key={i} index={i} takenAway={i < takenAwayCount} />
        ))}
      </View>
      <Text style={styles.animHint}>3 cookies taken away — 2 remain!</Text>
    </View>
  );
}

function ShapeCardItem({ shape, index, color }: { shape: { name: string; sides: string; icon: string }; index: number; color: string }) {
  const anim = useSpringAnim(index * 400);
  const labelAnim = useSpringAnim(index * 400 + 250);
  return (
    <Animated.View style={[styles.shapeCard, { borderColor: `${color}44` }, { opacity: anim, transform: [{ scale: anim }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
      <Text style={[styles.shapeIcon, { color }]}>{shape.icon}</Text>
      <Animated.Text style={[styles.shapeLabel, { opacity: labelAnim }]}>{shape.name}</Animated.Text>
      <Animated.Text style={[styles.shapeSides, { color, opacity: labelAnim }]}>{shape.sides} sides</Animated.Text>
    </Animated.View>
  );
}

function ShapesAnimation({ color }: { color: string }) {
  const shapes = [
    { name: 'Circle', sides: '0', icon: '●' },
    { name: 'Triangle', sides: '3', icon: '▲' },
    { name: 'Square', sides: '4', icon: '■' },
  ];
  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>Meet the Shapes!</Text>
      <View style={styles.shapesRow}>
        {shapes.map((s, i) => (
          <ShapeCardItem key={s.name} shape={s} index={i} color={color} />
        ))}
      </View>
      <Text style={styles.animHint}>Every shape has a name and a number of sides</Text>
    </View>
  );
}

function LetterItem({ letter, index, color }: { letter: string; index: number; color: string }) {
  const anim = useSpringAnim(index * 250);
  return (
    <Animated.View style={[styles.letterBox, { borderColor: `${color}44`, backgroundColor: `${color}18` }, { opacity: anim, transform: [{ scale: anim }, { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) }] }]}>
      <Text style={[styles.letterText, { color }]}>{letter}</Text>
    </Animated.View>
  );
}

function AlphabetAnimation({ color }: { color: string }) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>The Alphabet</Text>
      <View style={styles.abcRow}>
        {letters.map((l, i) => (
          <LetterItem key={l} letter={l} index={i} color={color} />
        ))}
      </View>
      <Text style={styles.animHint}>Letters come in order — A, B, C, D, E, F!</Text>
    </View>
  );
}

function PhonicsItem({ pair, index, color }: { pair: { letter: string; word: string; emoji: string }; index: number; color: string }) {
  const anim = useSpringAnim(index * 500);
  const revealAnim = useSpringAnim(index * 500 + 300);
  return (
    <Animated.View style={[styles.phonicsCard, { borderColor: `${color}33` }, { opacity: anim, transform: [{ scale: anim }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <Text style={[styles.phonicsLetter, { color }]}>{pair.letter}</Text>
      <Animated.Text style={[styles.phonicsEmoji, { opacity: revealAnim, transform: [{ scale: revealAnim }] }]}>{pair.emoji}</Animated.Text>
      <Animated.Text style={[styles.phonicsWord, { opacity: revealAnim }]}>{pair.word}</Animated.Text>
      <Animated.Text style={[styles.phonicsSound, { color, opacity: revealAnim }]}>/{pair.letter.toLowerCase()}/</Animated.Text>
    </Animated.View>
  );
}

function PhonicsAnimation({ color }: { color: string }) {
  const pairs = [
    { letter: 'A', word: 'Apple', emoji: '🍎' },
    { letter: 'B', word: 'Ball', emoji: '⚽' },
    { letter: 'C', word: 'Cat', emoji: '🐱' },
  ];
  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>Letter Sounds</Text>
      <View style={styles.phonicsRow}>
        {pairs.map((p, i) => (
          <PhonicsItem key={p.letter} pair={p} index={i} color={color} />
        ))}
      </View>
      <Text style={styles.animHint}>Every letter makes a sound — listen and learn!</Text>
    </View>
  );
}

function VocabPairItem({ pair, index, color }: { pair: { left: string; right: string }; index: number; color: string }) {
  const leftAnim = useSpringAnim(index * 350);
  const rightAnim = useSpringAnim(index * 350 + 200);
  return (
    <View style={styles.vocabRow}>
      <Animated.View style={[styles.vocabCard, { borderColor: `${color}44` }, { opacity: leftAnim, transform: [{ scale: leftAnim }, { translateX: leftAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <Text style={styles.vocabText}>{pair.left}</Text>
      </Animated.View>
      <Animated.Text style={[styles.vocabVs, { opacity: rightAnim }]}>vs</Animated.Text>
      <Animated.View style={[styles.vocabCard, { borderColor: '#FF537044' }, { opacity: rightAnim, transform: [{ scale: rightAnim }, { translateX: rightAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
        <Text style={styles.vocabText}>{pair.right}</Text>
      </Animated.View>
    </View>
  );
}

function VocabularyAnimation({ color }: { color: string }) {
  const pairs = [
    { left: 'Hot 🔥', right: 'Cold ❄️' },
    { left: 'Big 🐘', right: 'Small 🐭' },
    { left: 'Happy 😊', right: 'Sad 😢' },
  ];
  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>Opposites</Text>
      <View style={styles.vocabCol}>
        {pairs.map((p, i) => (
          <VocabPairItem key={i} pair={p} index={i} color={color} />
        ))}
      </View>
      <Text style={styles.animHint}>Opposites are words with opposite meanings!</Text>
    </View>
  );
}

function GrammarWordItem({ word, index, color }: { word: { text: string; type: string }; index: number; color: string }) {
  const anim = useSpringAnim(index * 400);
  const labelAnim = useSpringAnim(index * 400 + 250);
  return (
    <Animated.View style={{ alignItems: 'center', gap: 4, opacity: anim, transform: [{ scale: anim }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
      <View style={[styles.grammarWord, { borderColor: `${color}44`, backgroundColor: `${color}15` }]}>
        <Text style={[styles.grammarText, { color }]}>{word.text}</Text>
      </View>
      <Animated.Text style={[styles.grammarType, { opacity: labelAnim }]}>{word.type}</Animated.Text>
    </Animated.View>
  );
}

function GrammarAnimation({ color }: { color: string }) {
  const words = [
    { text: 'The', type: 'article' },
    { text: 'cat', type: 'noun' },
    { text: 'sleeps', type: 'verb' },
  ];
  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>Building Sentences</Text>
      <View style={styles.grammarRow}>
        {words.map((w, i) => (
          <GrammarWordItem key={i} word={w} index={i} color={color} />
        ))}
      </View>
      <Text style={styles.animHint}>Every sentence needs a noun and a verb!</Text>
    </View>
  );
}

const ANIM_DELAYS: Record<string, number> = {
  counting: 2000, addition: 2800, subtraction: 2800,
  shapes: 2500, alphabet: 2500, phonics: 2500,
  vocabulary: 2500, grammar: 2500,
};

function getAnimation(topicId: string, color: string) {
  switch (topicId) {
    case 'counting': return <CountingAnimation color={color} />;
    case 'addition': return <AdditionAnimation color={color} />;
    case 'subtraction': return <SubtractionAnimation color={color} />;
    case 'shapes': return <ShapesAnimation color={color} />;
    case 'alphabet': return <AlphabetAnimation color={color} />;
    case 'phonics': return <PhonicsAnimation color={color} />;
    case 'vocabulary': return <VocabularyAnimation color={color} />;
    case 'grammar': return <GrammarAnimation color={color} />;
    default: return <CountingAnimation color={color} />;
  }
}

function getTagline(topicId: string) {
  switch (topicId) {
    case 'counting': return 'Master counting!';
    case 'addition': return 'Master addition!';
    case 'subtraction': return 'Master subtraction!';
    case 'shapes': return 'Master shapes!';
    case 'alphabet': return 'Master the alphabet!';
    case 'phonics': return 'Master letter sounds!';
    case 'vocabulary': return 'Master vocabulary!';
    case 'grammar': return 'Master grammar!';
    default: return 'Ready to learn?';
  }
}

export default function ConceptAnimation({ topicId, topicColor, onComplete }: Props) {
  const [showBtn, setShowBtn] = useState(false);
  const btnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = ANIM_DELAYS[topicId] ?? 2500;
    const t = setTimeout(() => {
      setShowBtn(true);
      Animated.spring(btnAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    }, delay);
    return () => clearTimeout(t);
  }, [topicId]);

  return (
    <View style={styles.root}>
      {getAnimation(topicId, topicColor)}
      {showBtn && (
        <Animated.View style={{ opacity: btnAnim, transform: [{ scale: btnAnim }], width: '100%' }}>
          <TouchableOpacity style={[styles.continueBtn, { backgroundColor: topicColor }]} onPress={onComplete} activeOpacity={0.85}>
            <Text style={styles.continueText}>{getTagline(topicId)} Let's go!</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 20 },
  animContainer: { alignItems: 'center', gap: 20, width: '100%' },
  animTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  animHint: { fontSize: 13, color: '#8892B0', textAlign: 'center', marginTop: 8 },
  dotsRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  dot: { alignItems: 'center', justifyContent: 'center' },
  dotNum: { fontSize: 11, fontWeight: '700', color: '#8892B0', marginTop: 2 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  addEmoji: { fontSize: 32 },
  operator: { fontSize: 24, fontWeight: '800', color: '#CCCCCC' },
  resultCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  resultNum: { fontSize: 20, fontWeight: '800' },
  subRow: { flexDirection: 'row', gap: 10 },
  shapesRow: { flexDirection: 'row', gap: 16 },
  shapeCard: { alignItems: 'center', gap: 6, padding: 16, borderRadius: 16, borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.03)', minWidth: 90 },
  shapeIcon: { fontSize: 28 },
  shapeLabel: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  shapeSides: { fontSize: 11, fontWeight: '700' },
  abcRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  letterBox: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontSize: 22, fontWeight: '800' },
  phonicsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  phonicsCard: { alignItems: 'center', gap: 6, padding: 14, borderRadius: 16, borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.03)', minWidth: 100 },
  phonicsLetter: { fontSize: 26, fontWeight: '800' },
  phonicsEmoji: { fontSize: 28 },
  phonicsWord: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  phonicsSound: { fontSize: 11, fontWeight: '600' },
  vocabCol: { gap: 10, width: '100%' },
  vocabRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  vocabCard: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.03)' },
  vocabText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  vocabVs: { fontSize: 12, color: '#4A5080', fontWeight: '600' },
  grammarRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end' },
  grammarWord: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5 },
  grammarText: { fontSize: 16, fontWeight: '700' },
  grammarType: { fontSize: 10, color: '#8892B0', fontWeight: '600', textTransform: 'uppercase' },
  continueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 8 },
  continueText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
