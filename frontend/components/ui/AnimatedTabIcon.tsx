import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';

interface Props {
  Icon: LucideIcon;
  color: string;
  focused: boolean;
  size?: number;
}

export function AnimatedTabIcon({ Icon, color, focused, size = 22 }: Props) {
  const scale = useSharedValue(focused ? 1.15 : 1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, { damping: 14, stiffness: 220 });
  }, [focused]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={style}>
      <Icon size={size} color={color} strokeWidth={focused ? 2.4 : 2} />
    </Animated.View>
  );
}
