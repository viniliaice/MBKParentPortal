import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  label: string;
  color: string;
  /** 0-100, called continuously while dragging (no debounce — scenes are cheap to re-render). */
  onChange: (value: number) => void;
  /** fires once per crossed 10% band, used for light haptic "detents" while dragging. */
  hapticStep?: number;
}

/**
 * A from-scratch horizontal drag slider (0-100) built on PanResponder —
 * there is no slider component installed in this project (no
 * @react-native-community/slider), and pulling one in for a single feature
 * would be a heavier dependency than just building the ~90 lines needed here.
 * Works on iOS/Android/Web since PanResponder is core React Native.
 *
 * Uses pageX + a measured absolute track offset (not the touch event's
 * locationX) because locationX during onPanResponderMove is relative to the
 * element under the *original* touch point and can drift once the finger
 * moves outside that view's bounds — pageX combined with a fixed offset
 * captured on grant is the standard robust pattern for drag tracks.
 */
export default function DraggableSlider({ label, color, onChange, hapticStep = 10 }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [value, setValue] = useState(0);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const trackRef = useRef<View>(null);
  const lastHapticBandRef = useRef(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWidthRef.current = w;
    setTrackWidth(w);
    trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
      trackPageXRef.current = pageX;
    });
  };

  const updateFromPageX = useCallback((pageX: number) => {
    const w = trackWidthRef.current;
    if (w <= 0) return;
    const relativeX = pageX - trackPageXRef.current;
    const pct = Math.max(0, Math.min(100, (relativeX / w) * 100));
    setValue(pct);
    onChange(pct);

    const band = Math.floor(pct / hapticStep);
    if (band !== lastHapticBandRef.current) {
      lastHapticBandRef.current = band;
      Haptics.selectionAsync();
    }
  }, [onChange, hapticStep]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
          trackPageXRef.current = pageX;
          updateFromPageX(evt.nativeEvent.pageX);
        });
      },
      onPanResponderMove: (evt) => updateFromPageX(evt.nativeEvent.pageX),
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.valueLabel, { color }]}>{Math.round(value)}%</Text>
      </View>
      <View ref={trackRef} style={styles.track} onLayout={onLayout} {...panResponder.panHandlers}>
        <View style={styles.trackBg} />
        <View style={[styles.trackFill, { width: `${value}%`, backgroundColor: color }]} />
        <View
          style={[
            styles.handle,
            {
              left: trackWidth > 0 ? Math.max(0, Math.min(trackWidth - 28, (value / 100) * trackWidth - 14)) : 0,
              borderColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: '#CCCCCC' },
  valueLabel: { fontSize: 13, fontWeight: '800' },
  track: { height: 44, justifyContent: 'center' },
  trackBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  trackFill: { position: 'absolute', height: 8, borderRadius: 4 },
  handle: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#141D3A', borderWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
