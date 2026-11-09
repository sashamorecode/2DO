import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors } from '../../constants/colors';

interface Props {
  onComplete: () => void;
  size?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function CompletionButton({ onComplete, disabled, size = 24, accessibilityLabel = 'Complete task' }: Props) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    // Quick punch-and-relax for press feedback. We fire the parent callback
    // synchronously here — the parent owns the disappearing-card animation,
    // which is the visual signal that the task was completed.
    if (!reducedMotion) scale.value = withSequence(
      withTiming(1.25, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 160, easing: Easing.inOut(Easing.quad) })
    );
    onComplete();
  }

  return (
    <TouchableOpacity onPress={handlePress} disabled={disabled} accessibilityState={{ disabled: !!disabled }} style={styles.target} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <Animated.View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: 7 },
          animatedStyle,
        ]}
      >
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  target: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  circle: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
