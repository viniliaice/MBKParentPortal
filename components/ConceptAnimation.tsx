import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  topicId: string;
  topicColor: string;
  onComplete: () => void;
  review?: boolean;
}

interface ConceptItem {
  emoji?: string;
  label?: string;
}

interface ConceptScene {
  instruction: string;
  items: ConceptItem[];
  revealText: string;
  revealEquation?: string;
  revealEmojis?: string[];
}

interface Concept {
  scenes: ConceptScene[];
  tagline: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CONCEPTS: Record<string, Concept> = {
  counting: {
    tagline: 'Ready to count?',
    scenes: [
      {
        instruction: 'Tap each apple and count out loud',
        items: [{ emoji: '🍎' }, { emoji: '🍎' }, { emoji: '🍎' }],
        revealText: '3 apples! You counted to 3.',
        revealEquation: '1, 2, 3',
      },
      {
        instruction: 'Now count these stars — tap each one',
        items: [{ emoji: '⭐' }, { emoji: '⭐' }, { emoji: '⭐' }, { emoji: '⭐' }, { emoji: '⭐' }],
        revealText: '5 stars! You can count to 5.',
        revealEquation: '1, 2, 3, 4, 5',
      },
    ],
  },
  addition: {
    tagline: 'Let us add!',
    scenes: [
      {
        instruction: 'Tap the apples on the left, then the right',
        items: [{ emoji: '🍎' }, { emoji: '🍎' }, { emoji: '🍎' }, { emoji: '🍏' }, { emoji: '🍏' }],
        revealText: '3 red + 2 green = 5 apples together!',
        revealEquation: '3 + 2 = 5',
        revealEmojis: ['🍎', '🍎', '🍎', '🍏', '🍏'],
      },
      {
        instruction: 'Tap each group to combine them',
        items: [{ emoji: '🔵' }, { emoji: '🔵' }, { emoji: '🔵' }, { emoji: '🔵' }, { emoji: '🟡' }, { emoji: '🟡' }, { emoji: '🟡' }],
        revealText: '4 blue + 3 yellow = 7 circles!',
        revealEquation: '4 + 3 = 7',
      },
    ],
  },
  subtraction: {
    tagline: 'Let us subtract!',
    scenes: [
      {
        instruction: 'Tap 3 cookies to take them away',
        items: [{ emoji: '🍪' }, { emoji: '🍪' }, { emoji: '🍪' }, { emoji: '🍪' }, { emoji: '🍪' }],
        revealText: '5 cookies minus 3 = 2 left!',
        revealEquation: '5 − 3 = 2',
        revealEmojis: ['🍪', '🍪'],
      },
      {
        instruction: 'Tap 2 balloons to let them fly away',
        items: [{ emoji: '🎈' }, { emoji: '🎈' }, { emoji: '🎈' }, { emoji: '🎈' }, { emoji: '🎈' }, { emoji: '🎈' }],
        revealText: '6 balloons minus 2 = 4 remain!',
        revealEquation: '6 − 2 = 4',
      },
    ],
  },
  shapes: {
    tagline: 'Meet the shapes!',
    scenes: [
      {
        instruction: 'Tap each shape to discover it',
        items: [{ label: '●\nCircle' }, { label: '▲\nTriangle' }, { label: '■\nSquare' }],
        revealText: 'Every shape has a name and a number of sides!',
        revealEquation: 'Circle: 0  Triangle: 3  Square: 4',
      },
    ],
  },
  alphabet: {
    tagline: 'Learn the alphabet!',
    scenes: [
      {
        instruction: 'Tap each letter in order',
        items: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }, { label: 'E' }, { label: 'F' }],
        revealText: 'A, B, C, D, E, F — letters come in order!',
        revealEquation: 'A B C D E F',
      },
    ],
  },
  phonics: {
    tagline: 'Hear the sounds!',
    scenes: [
      {
        instruction: 'Tap each letter to hear its sound',
        items: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
        revealText: 'Every letter makes a special sound!',
        revealEquation: '/a/ /b/ /k/',
      },
    ],
  },
  vocabulary: {
    tagline: 'Learn opposites!',
    scenes: [
      {
        instruction: 'Tap each pair of opposites',
        items: [{ label: 'Hot 🔥' }, { label: 'Cold ❄️' }, { label: 'Big 🐘' }, { label: 'Small 🐭' }],
        revealText: 'Opposites are words with opposite meanings!',
        revealEquation: 'Hot ↔ Cold   Big ↔ Small',
      },
    ],
  },
  grammar: {
    tagline: 'Build sentences!',
    scenes: [
      {
        instruction: 'Tap each word to reveal its job',
        items: [{ label: 'The' }, { label: 'cat' }, { label: 'sleeps' }],
        revealText: 'Every sentence needs a noun and a verb!',
        revealEquation: 'The (article) + cat (noun) + sleeps (verb)',
      },
    ],
  },
};

const PHONICS_SOUNDS: Record<string, string> = { A: '/a/', B: '/b/', C: '/k/' };
const GRAMMAR_TYPES: Record<string, string> = { The: 'article', cat: 'noun', sleeps: 'verb' };
const SHAPE_SIDES: Record<string, string> = { Circle: '0 sides', Triangle: '3 sides', Square: '4 sides' };

function TappableObject({
  item, index, color, tapped, onTap, totalTaps,
}: {
  item: ConceptItem; index: number; color: string; tapped: boolean; onTap: () => void; totalTaps: number;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(1)).current;
  const tapNum = tapped ? index + 1 : null;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1, friction: 6, tension: 80, delay: index * 120, useNativeDriver: true,
    }).start();
  }, [index]);

  const handlePress = () => {
    if (tapped) return;
    Animated.sequence([
      Animated.timing(bounce, { toValue: 1.25, duration: 120, useNativeDriver: true }),
      Animated.spring(bounce, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
    ]).start();
    onTap();
  };

  const isShape = item.label?.includes('\n');
  const shapeName = isShape ? item.label?.split('\n')[1] : null;
  const isLetter = item.label?.length === 1 && /[A-Z]/.test(item.label);
  const isPhonicsLetter = isLetter && PHONICS_SOUNDS[item.label!];
  const isGrammarWord = GRAMMAR_TYPES[item.label!];

  return (
    <Animated.View
      style={[
        { opacity: scale, transform: [{ scale: Animated.multiply(scale, bounce) }] },
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={tapped}
        style={[
          styles.obj,
          tapped && { backgroundColor: `${color}28`, borderColor: color },
        ]}
      >
        {item.emoji && (
          <Text style={[styles.objEmoji, tapped && { opacity: 0.5 }]}>{item.emoji}</Text>
        )}
        {item.label && (
          <Text style={[styles.objLabel, { color: tapped ? color : '#FFFFFF' }]}>
            {item.label}
          </Text>
        )}
        {tapped && (
          <View style={[styles.objBadge, { backgroundColor: color }]}>
            {isPhonicsLetter ? (
              <Text style={styles.objBadgeText}>{PHONICS_SOUNDS[item.label!]}</Text>
            ) : isGrammarWord ? (
              <Text style={styles.objBadgeText}>{GRAMMAR_TYPES[item.label!]}</Text>
            ) : isShape && shapeName && SHAPE_SIDES[shapeName] ? (
              <Text style={styles.objBadgeText}>{SHAPE_SIDES[shapeName]}</Text>
            ) : tapNum !== null ? (
              <Text style={styles.objBadgeText}>{tapNum}</Text>
            ) : (
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function ProgressDots({ count, current, color }: { count: number; current: number; color: string }) {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            { backgroundColor: i < current ? color : i === current ? `${color}66` : 'rgba(255,255,255,0.12)' },
          ]}
        />
      ))}
    </View>
  );
}

function RevealPanel({ scene, color, visible }: { scene: ConceptScene; color: string; visible: boolean }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, friction: 6, tension: 60, useNativeDriver: true }),
      ]).start();
    } else {
      fade.setValue(0);
      slide.setValue(30);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.revealPanel, { borderColor: `${color}44`, opacity: fade, transform: [{ translateY: slide }] }]}>
      <View style={[styles.revealIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name="bulb-outline" size={22} color={color} />
      </View>
      <Text style={styles.revealText}>{scene.revealText}</Text>
      {scene.revealEquation && (
        <View style={[styles.equationBadge, { backgroundColor: `${color}18` }]}>
          <Text style={[styles.equationText, { color }]}>{scene.revealEquation}</Text>
        </View>
      )}
    </Animated.View>
  );
}

export default function ConceptAnimation({ topicId, topicColor, onComplete, review }: Props) {
  const concept = CONCEPTS[topicId] ?? CONCEPTS.counting;
  const scenes = review ? concept.scenes.slice(0, 1) : concept.scenes;
  const [sceneIdx, setSceneIdx] = useState(0);
  const [tappedSet, setTappedSet] = useState<Set<number>>(new Set());
  const [sceneDone, setSceneDone] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const btnAnim = useRef(new Animated.Value(0)).current;
  const sceneFade = useRef(new Animated.Value(0)).current;

  const scene = scenes[sceneIdx];
  const totalTaps = scene.items.length;

  const handleTap = useCallback((idx: number) => {
    setTappedSet(prev => {
      const next = new Set(prev);
      next.add(idx);
      if (next.size >= totalTaps) {
        setTimeout(() => setSceneDone(true), 400);
      }
      return next;
    });
  }, [totalTaps]);

  useEffect(() => {
    sceneFade.setValue(0);
    Animated.timing(sceneFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [sceneIdx]);

  useEffect(() => {
    if (allDone) {
      Animated.spring(btnAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    }
  }, [allDone]);

  const handleNextScene = () => {
    if (sceneIdx < scenes.length - 1) {
      setSceneIdx(sceneIdx + 1);
      setTappedSet(new Set());
      setSceneDone(false);
    } else {
      setAllDone(true);
    }
  };

  return (
    <View style={styles.root}>
      {!review && <ProgressDots count={scenes.length} current={sceneIdx} color={topicColor} />}

      <Animated.View style={[styles.sceneContainer, { opacity: sceneFade, flex: 1 }]}>
        <View style={styles.instructionRow}>
          <View style={[styles.instructionIcon, { backgroundColor: `${topicColor}22` }]}>
            <Ionicons name="hand-left-outline" size={18} color={topicColor} />
          </View>
          <Text style={styles.instructionText}>{scene.instruction}</Text>
        </View>

        <View style={styles.objectsArea}>
          <View style={styles.objectsGrid}>
            {scene.items.map((item, i) => (
              <TappableObject
                key={`${sceneIdx}-${i}`}
                item={item}
                index={i}
                color={topicColor}
                tapped={tappedSet.has(i)}
                onTap={() => handleTap(i)}
                totalTaps={totalTaps}
              />
            ))}
          </View>

          <View style={styles.tapCounter}>
            <Text style={styles.tapCounterText}>
              {tappedSet.size} / {totalTaps} tapped
            </Text>
          </View>
        </View>

        <RevealPanel scene={scene} color={topicColor} visible={sceneDone} />
      </Animated.View>

      {sceneDone && !allDone && (
        <TouchableOpacity
          style={[styles.nextSceneBtn, { backgroundColor: topicColor }]}
          onPress={handleNextScene}
          activeOpacity={0.85}
        >
          <Text style={styles.nextSceneBtnText}>
            {sceneIdx < scenes.length - 1 ? 'Continue' : review ? 'Try again' : 'I get it!'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {allDone && (
        <Animated.View style={{ opacity: btnAnim, transform: [{ scale: btnAnim }], width: '100%' }}>
          <TouchableOpacity
            style={[styles.practiceBtn, { backgroundColor: topicColor }]}
            onPress={onComplete}
            activeOpacity={0.85}
          >
            <Text style={styles.practiceBtnText}>{review ? 'Back to the question' : `${concept.tagline} Let us practice!`}</Text>
            <Ionicons name={review ? 'refresh' : 'arrow-forward'} size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20, gap: 16 },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  progressDot: { width: 28, height: 5, borderRadius: 3 },
  sceneContainer: { gap: 16 },
  instructionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  instructionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  instructionText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#FFFFFF', lineHeight: 20 },
  objectsArea: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  objectsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  obj: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  objEmoji: { fontSize: 34 },
  objLabel: { fontSize: 16, fontWeight: '800', textAlign: 'center', lineHeight: 20 },
  objBadge: {
    position: 'absolute', bottom: -8, right: -8,
    minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0B1026',
  },
  objBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  tapCounter: { alignItems: 'center' },
  tapCounterText: { fontSize: 12, fontWeight: '600', color: '#4A5080' },
  revealPanel: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, padding: 18,
    borderWidth: 1.5, alignItems: 'center', gap: 12,
  },
  revealIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  revealText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', lineHeight: 22 },
  equationBadge: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  equationText: { fontSize: 15, fontWeight: '800' },
  nextSceneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 16,
  },
  nextSceneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  practiceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16,
  },
  practiceBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
