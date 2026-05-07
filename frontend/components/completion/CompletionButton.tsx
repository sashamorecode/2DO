import React, { useRef } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
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
    scale.value = withSequence(
      withSpring(1.3, { damping: 4 }),
      withTiming(0, { duration: 300 }, (finished) => {
        if (finished) runOnJS(onComplete)();
      })
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} hitSlop={12} activeOpacity={0.7}>
      <Animated.View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, animatedStyle]}>
        <Animated.Text style={styles.check}>✓</Animated.Text>
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
  check: { color: colors.success, fontWeight: '800', fontSize: 18 },
});
