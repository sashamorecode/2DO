import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../../constants/colors';

interface Props {
  onComplete: () => void;
  size?: number;
  accessibilityLabel?: string;
}

export function CompletionButton({ onComplete, size = 24, accessibilityLabel = 'Complete task' }: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    // Quick punch-and-relax for press feedback. We fire the parent callback
    // synchronously here — the parent owns the disappearing-card animation,
    // which is the visual signal that the task was completed.
    scale.value = withSequence(
      withTiming(1.25, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 160, easing: Easing.inOut(Easing.quad) })
    );
    onComplete();
  }

  return (
    <TouchableOpacity onPress={handlePress} hitSlop={10} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
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
  circle: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
