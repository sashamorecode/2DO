import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { colors } from '../../constants/colors';

interface Props {
  onComplete: () => void;
  size?: number;
}

export function CompletionButton({ onComplete, size = 36 }: Props) {
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
    <TouchableOpacity onPress={handlePress} hitSlop={12} activeOpacity={0.7}>
      <Animated.View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
          animatedStyle,
        ]}
      >
        <Check size={size * 0.55} color={colors.success} strokeWidth={3} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.success + '22',
    borderWidth: 2,
    borderColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
