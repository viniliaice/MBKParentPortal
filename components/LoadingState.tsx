import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  /** Number of card-shaped placeholders under the hero block. */
  blocks?: number;
  /** Draw a taller placeholder first (a summary card). */
  hero?: boolean;
  style?: React.ComponentProps<typeof View>['style'];
}

/** A pulse in the shape of the content that is coming — used while the first load runs. */
export function LoadingState({ blocks = 3, hero = true, style }: Props) {
  const c = useColors();
  const fade = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [fade]);

  const block = { backgroundColor: c.skeleton };

  return (
    <Animated.View style={[styles.wrap, { opacity: fade }, style]}>
      {hero ? <View style={[styles.hero, block]} /> : null}
      {Array.from({ length: blocks }).map((_, i) => (
        <View key={i} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.line, styles.lineWide, block]} />
          <View style={[styles.line, styles.lineNarrow, block]} />
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 10 },
  hero: { height: 140, borderRadius: 20 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  line: { height: 12, borderRadius: 6 },
  lineWide: { width: '65%' },
  lineNarrow: { width: '35%' },
});
