import React, { useRef } from 'react';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * MultipleChoice/FillBlank/NumberLine/Writing activities previously used a
 * bare TouchableOpacity per option — no scale feedback and no haptic on tap
 * (only ActivityRenderer's wrapper fired haptics, and only after the answer
 * was already scored). This makes every individual tap feel alive the
 * instant a finger lands, matching MatchPairsActivity/TrueFalseActivity's
 * existing per-tap haptics.
 */
export default function PressableTile({ style, onPress, disabled, children }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.93, friction: 7, tension: 300, useNativeDriver: true }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 250, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      style={({ pressed }) => [style, pressed && !disabled && { opacity: 0.85 }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
