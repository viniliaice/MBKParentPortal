import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Point { x: number; y: number }

interface Props {
  from: Point;
  to: Point;
  thickness?: number;
  color: string;
  borderColor?: string;
  /** 0-1: how much of this segment (from `from` toward `to`) is "filled" with a highlighted color — used to show liquid climbing a pipe. */
  fillProgress?: number;
  fillColor?: string;
}

/**
 * A straight pipe/tube segment drawn between two arbitrary points using
 * transformOrigin-anchored rotation (RN 0.81 supports `transformOrigin`,
 * confirmed against this project's react-native version). This is the
 * building block for any angled plumbing/tubing diagram — the toilet's
 * ascending/descending trapway legs, but equally reusable for blood
 * vessels in a future Biology lesson or glass tubing in Chemistry. Not
 * Physics-specific despite living under the toilet cutaway right now.
 */
export default function PipeSegment({ from, to, thickness = 20, color, borderColor, fillProgress = 0, fillColor }: Props) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <View style={[styles.anchor, { left: from.x, top: from.y }]}>
      <View
        style={[
          styles.bar,
          {
            width: length,
            height: thickness,
            top: -thickness / 2,
            backgroundColor: color,
            borderColor: borderColor ?? 'transparent',
            transform: [{ rotate: `${angleDeg}deg` }],
            transformOrigin: '0% 50%',
          },
        ]}
      >
        {fillProgress > 0 && fillColor && (
          <View style={[styles.fill, { width: `${Math.min(100, fillProgress * 100)}%`, backgroundColor: fillColor }]} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0 },
  bar: { position: 'absolute', left: 0, borderWidth: 1.5, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
});
