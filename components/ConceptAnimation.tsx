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

function AnimatedDot({ index, color, total }: { index: number; color: string; total: number }) {
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
          <AnimatedDot key={i} index={i} color={color} total={count} />
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

function SubtractionAnimation({ color }: { color: string }) {
  const items = useRef([...Array(5)].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(400, items.slice(0, 3).map((v, i) =>
      Animated.parallel([
        Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(800),
          Animated.parallel([
            Animated.timing(v, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.timing(v, { toValue: -60, duration: 400, useNativeDriver: true }),
          ]),
        ]),
      ])
    )).start();
  }, []);

  const remaining = items.slice(3);

  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>Subtraction = Taking Away</Text>
      <View style={styles.subRow}>
        {items.map((anim, i) => {
          const isRemaining = i >= 3;
          return (
            <Animated.View key={i} style={{ opacity: isRemaining ? 1 : anim, transform: [{ translateY: isRemaining ? new Animated.Value(0) : anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) }] }}>
              <Text style={styles.addEmoji}>🍪</Text>
            </Animated.View>
          );
        })}
      </View>
      <Text style={styles.animHint}>3 cookies taken away — 2 remain!</Text>
    </View>
  );
}

function ShapesAnimation({ color }: { color: string }) {
  const shapes = [
    { name: 'Circle', sides: '0', icon: '●', size: 14 },
    { name: 'Triangle', sides: '3', icon: '▲', size: 16 },
    { name: 'Square', sides: '4', icon: '■', size: 14 },
  ];

  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>Meet the Shapes!</Text>
      <View style={styles.shapesRow}>
        {shapes.map((s, i) => {
          const anim = useSpringAnim(i * 400);
          const labelAnim = useSpringAnim(i * 400 + 250);
          return (
            <Animated.View key={s.name} style={[styles.shapeCard, { borderColor: `${color}44` }, { opacity: anim, transform: [{ scale: anim }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
              <Text style={[styles.shapeIcon, { color }]}>{s.icon}</Text>
              <Animated.Text style={[styles.shapeLabel, { opacity: labelAnim }]}>{s.name}</Animated.Text>
              <Animated.Text style={[styles.shapeSides, { color, opacity: labelAnim }]}>{s.sides} sides</Animated.Text>
            </Animated.View>
          );
        })}
      </View>
      <Text style={styles.animHint}>Every shape has a name and a number of sides</Text>
    </View>
  );
}

function AlphabetAnimation({ color }: { color: string }) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>The Alphabet</Text>
      <View style={styles.abcRow}>
        {letters.map((l, i) => {
          const anim = useSpringAnim(i * 250);
          return (
            <Animated.View key={l} style={[styles.letterBox, { borderColor: `${color}44`, backgroundColor: `${color}18` }, { opacity: anim, transform: [{ scale: anim }, { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) }] }]}>
              <Text style={[styles.letterText, { color }]}>{l}</Text>
            </Animated.View>
          );
        })}
      </View>
      <Text style={styles.animHint}>Letters come in order — A, B, C, D, E, F!</Text>
    </View>
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
        {pairs.map((p, i) => {
          const anim = useSpringAnim(i * 500);
          const revealAnim = useSpringAnim(i * 500 + 300);
          return (
            <Animated.View key={p.letter} style={[styles.phonicsCard, { borderColor: `${color}33` }, { opacity: anim, transform: [{ scale: anim }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
              <Text style={[styles.phonicsLetter, { color }]}>{p.letter}</Text>
              <Animated.Text style={[styles.phonicsEmoji, { opacity: revealAnim, transform: [{ scale: revealAnim }] }]}>{p.emoji}</Animated.Text>
              <Animated.Text style={[styles.phonicsWord, { opacity: revealAnim }]}>{p.word}</Animated.Text>
              <Animated.Text style={[styles.phonicsSound, { color, opacity: revealAnim }]}>/p.letter.toLowerCase()/</Animated.Text>
            </Animated.View>
          );
        })}
      </View>
      <Text style={styles.animHint}>Every letter makes a sound — listen and learn!</Text>
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
        {pairs.map((p, i) => {
          const leftAnim = useSpringAnim(i * 350);
          const rightAnim = useSpringAnim(i * 350 + 200);
          return (
            <View key={i} style={styles.vocabRow}>
              <Animated.View style={[styles.vocabCard, { borderColor: `${color}44` }, { opacity: leftAnim, transform: [{ scale: leftAnim }, { translateX: leftAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
                <Text style={styles.vocabText}>{p.left}</Text>
              </Animated.View>
              <Animated.Text style={[styles.vocabVs, { opacity: rightAnim }]}>vs</Animated.Text>
              <Animated.View style={[styles.vocabCard, { borderColor: '#FF537044' }, { opacity: rightAnim, transform: [{ scale: rightAnim }, { translateX: rightAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
                <Text style={styles.vocabText}>{p.right}</Text>
              </Animated.View>
            </View>
          );
        })}
      </View>
      <Text style={styles.animHint}>Opposites are words with opposite meanings!</Text>
    </View>
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
        {words.map((w, i) => {
          const anim = useSpringAnim(i * 400);
          const labelAnim = useSpringAnim(i * 400 + 250);
          return (
            <Animated.View key={i} style={{ alignItems: 'center', gap: 4, opacity: anim, transform: [{ scale: anim }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
              <View style={[styles.grammarWord, { borderColor: `${color}44`, backgroundColor: `${color}15` }]}>
                <Text style={[styles.grammarText, { color }]}>{w.text}</Text>
              </View>
              <Animated.Text style={[styles.grammarType, { opacity: labelAnim }]}>{w.type}</Animated.Text>
            </Animated.View>
          );
        })}
      </View>
      <Text style={styles.animHint}>Every sentence needs a noun and a verb!</Text>
    </View>
  );
}

function TrueFalseAnimation({ color }: { color: string }) {
  const trueAnim = useSpringAnim(300);
  const falseAnim = useSpringAnim(900);
  const checkAnim = useSpringAnim(1500);

  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>True or False?</Text>
      <View style={styles.tfAnimRow}>
        <Animated.View style={[styles.tfAnimCard, { borderColor: '#2ECC7166', backgroundColor: 'rgba(46,204,113,0.1)' }, { opacity: trueAnim, transform: [{ scale: trueAnim }] }]}>
          <Ionicons name="checkmark-circle" size={28} color="#2ECC71" />
          <Text style={[styles.tfAnimText, { color: '#2ECC71' }]}>TRUE</Text>
        </Animated.View>
        <Animated.Text style={[styles.tfAnimVs, { opacity: checkAnim }]}>or</Animated.Text>
        <Animated.View style={[styles.tfAnimCard, { borderColor: '#FF537066', backgroundColor: 'rgba(255,83,112,0.1)' }, { opacity: falseAnim, transform: [{ scale: falseAnim }] }]}>
          <Ionicons name="close-circle" size={28} color="#FF5370" />
          <Text style={[styles.tfAnimText, { color: '#FF5370' }]}>FALSE</Text>
        </Animated.View>
      </View>
      <Text style={styles.animHint}>Read the statement — is it true or false?</Text>
    </View>
  );
}

function WritingAnimation({ color }: { color: string }) {
  const examples = [
    { word: 'Blue', desc: 'colour of the sky' },
    { word: 'Happy', desc: 'feeling good' },
    { word: 'Fast', desc: 'quick speed' },
  ];

  return (
    <View style={styles.animContainer}>
      <Text style={styles.animTitle}>Spelling Practice</Text>
      <View style={styles.writingCol}>
        {examples.map((ex, i) => {
          const wordAnim = useSpringAnim(i * 500);
          const descAnim = useSpringAnim(i * 500 + 250);
          return (
            <Animated.View key={i} style={[styles.writingCard, { borderColor: `${color}33` }, { opacity: wordAnim, transform: [{ scale: wordAnim }, { translateX: wordAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
              <Text style={[styles.writingWord, { color }]}>{ex.word}</Text>
              <Animated.Text style={[styles.writingDesc, { opacity: descAnim }]}>— {ex.desc}</Animated.Text>
            </Animated.View>
          );
        })}
      </View>
      <Text style={styles.animHint}>Pick the correct spelling for each word</Text>
    </View>
  );
}

export default function ConceptAnimation({ topicId, topicColor, onComplete }: Props) {
  const [showBtn, setShowBtn] = useState(false);
  const btnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      setShowBtn(true);
      Animated.spring(btnAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    }, topicId.startsWith('cnt') ? 2000 : topicId.startsWith('add') ? 2800 : topicId.startsWith('sub') ? 2800 : 2500);
    return () => clearTimeout(t);
  }, []);

  const prefix = topicId?.split('_')[0] || 'cnt';

  const content = () => {
    switch (prefix) {
      case 'cnt': return <CountingAnimation color={topicColor} />;
      case 'add': return <AdditionAnimation color={topicColor} />;
      case 'sub': return <SubtractionAnimation color={topicColor} />;
      case 'shp': return <ShapesAnimation color={topicColor} />;
      case 'abc': return <AlphabetAnimation color={topicColor} />;
      case 'pho': return <PhonicsAnimation color={topicColor} />;
      case 'voc': return <VocabularyAnimation color={topicColor} />;
      case 'grm': return <GrammarAnimation color={topicColor} />;
      case 'tf':
      case 'truefalse': return <TrueFalseAnimation color={topicColor} />;
      case 'wrt':
      case 'writing': return <WritingAnimation color={topicColor} />;
      default: return <CountingAnimation color={topicColor} />;
    }
  };

  const getTagline = () => {
    switch (prefix) {
      case 'cnt': return 'Master counting!';
      case 'add': return 'Master addition!';
      case 'sub': return 'Master subtraction!';
      case 'shp': return 'Master shapes!';
      case 'abc': return 'Master the alphabet!';
      case 'pho': return 'Master letter sounds!';
      case 'voc': return 'Master vocabulary!';
      case 'grm': return 'Master grammar!';
      default: return 'Ready to learn?';
    }
  };

  return (
    <View style={styles.root}>
      {content()}
      {showBtn && (
        <Animated.View style={{ opacity: btnAnim, transform: [{ scale: btnAnim }], width: '100%' }}>
          <TouchableOpacity style={[styles.continueBtn, { backgroundColor: topicColor }]} onPress={onComplete} activeOpacity={0.85}>
            <Text style={styles.continueText}>{getTagline()} Let's go!</Text>
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
  tfAnimRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tfAnimCard: { width: 100, height: 100, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 6 },
  tfAnimText: { fontSize: 16, fontWeight: '800' },
  tfAnimVs: { fontSize: 14, color: '#8892B0', fontWeight: '600' },
  writingCol: { gap: 10, width: '100%', maxWidth: 280 },
  writingCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.03)' },
  writingWord: { fontSize: 18, fontWeight: '800' },
  writingDesc: { fontSize: 13, color: '#8892B0' },
  continueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 8 },
  continueText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
