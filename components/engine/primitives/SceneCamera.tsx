import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

export interface CameraShot {
  /** 1 = fully zoomed out. Larger = zoomed in. */
  scale: number;
  /** 0-100, the point in the scene (as a % of sceneWidth) the camera centers on. */
  focusX: number;
  /** 0-100, the point in the scene (as a % of sceneHeight) the camera centers on. */
  focusY: number;
}

interface Props {
  /** the fixed-size "world" the camera moves around inside — children are laid out in this coordinate space */
  sceneWidth: number;
  sceneHeight: number;
  /** the visible window onto that world */
  viewportWidth: number;
  viewportHeight: number;
  shot: CameraShot;
  /** ms for the camera move between shots — this is deliberately slow and eased, a cinematic pan/zoom, not a cut */
  durationMs?: number;
  children: React.ReactNode;
  style?: object;
}

const DEFAULT_SHOT: CameraShot = { scale: 1, focusX: 50, focusY: 50 };

/**
 * A generic cinematic camera for any fixed-size illustrated scene: give it
 * a "shot" (zoom level + focus point) and it smoothly pans/zooms there,
 * scaling *about the focus point* rather than the viewport's own center —
 * built for "zoom into the siphon when it activates, zoom into the float
 * valve while refilling" style attention-directing, and reusable for any
 * future lesson that stages a diagram through a guided sequence (a cell
 * diagram, a circuit board, an engine).
 *
 * How it works: an inner layer is translated so the focus point lands at
 * the viewport's center, then an outer layer scales about its own center —
 * which, after that translation, *is* the focus point. Pure transform math,
 * no SVG/Skia required.
 */
export default function SceneCamera({ sceneWidth, sceneHeight, viewportWidth, viewportHeight, shot, durationMs = 900, children, style }: Props) {
  const scale = useSharedValue(shot?.scale ?? DEFAULT_SHOT.scale);
  const focusX = useSharedValue(shot?.focusX ?? DEFAULT_SHOT.focusX);
  const focusY = useSharedValue(shot?.focusY ?? DEFAULT_SHOT.focusY);

  useEffect(() => {
    const easing = Easing.inOut(Easing.cubic);
    scale.value = withTiming(shot.scale, { duration: durationMs, easing });
    focusX.value = withTiming(shot.focusX, { duration: durationMs, easing });
    focusY.value = withTiming(shot.focusY, { duration: durationMs, easing });
  }, [shot.scale, shot.focusX, shot.focusY, durationMs]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const panStyle = useAnimatedStyle(() => {
    const fxPx = (focusX.value / 100) * sceneWidth;
    const fyPx = (focusY.value / 100) * sceneHeight;
    return {
      transform: [
        { translateX: viewportWidth / 2 - fxPx },
        { translateY: viewportHeight / 2 - fyPx },
      ],
    };
  });

  return (
    <View style={[styles.viewport, { width: viewportWidth, height: viewportHeight }, style]}>
      <Animated.View style={[styles.scaleLayer, { width: viewportWidth, height: viewportHeight }, scaleStyle]}>
        <Animated.View style={[styles.panLayer, { width: sceneWidth, height: sceneHeight }, panStyle]}>
          {children}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden', position: 'relative' },
  scaleLayer: { position: 'absolute', top: 0, left: 0 },
  panLayer: { position: 'absolute', top: 0, left: 0 },
});
