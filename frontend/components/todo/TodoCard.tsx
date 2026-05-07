import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '../../constants/colors';
import { Todo } from '../../services/todos.api';
import { PriorityBadge } from './PriorityBadge';
import { DeadlineBadge } from './DeadlineBadge';
import { CompletionButton } from '../completion/CompletionButton';
import { playCompletionSound } from '../completion/CompletionSound';
import { ConfettiOverlay, ConfettiOverlayRef } from '../completion/ConfettiOverlay';

interface Props {
  todo: Todo;
  onComplete?: (id: string) => void;
  onPress?: (todo: Todo) => void;
  readOnly?: boolean;
}

export function TodoCard({ todo, onComplete, onPress, readOnly }: Props) {
  const opacity = useSharedValue(1);
  const height = useSharedValue<number | undefined>(undefined);
  const confettiRef = useRef<ConfettiOverlayRef>(null);
  const cardRef = useRef<View>(null);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: opacity.value }],
  }));

  async function handleComplete() {
    cardRef.current?.measure((x, y, w, h, px, py) => {
      confettiRef.current?.fire(px + w / 2, py + h / 2);
    });

    playCompletionSound();

    opacity.value = withTiming(0, { duration: 400 }, () => {
      // let parent remove after animation
    });

    setTimeout(() => {
      onComplete?.(todo.id);
    }, 380);
  }

  return (
    <>
      <ConfettiOverlay ref={confettiRef} />
      <Animated.View style={animStyle}>
        <TouchableOpacity
          ref={cardRef as any}
          style={styles.card}
          onPress={() => onPress?.(todo)}
          activeOpacity={0.85}
          disabled={!onPress}
        >
          <View style={styles.left}>
            {!readOnly && <CompletionButton onComplete={handleComplete} />}
            <View style={styles.content}>
              <Text style={styles.title} numberOfLines={2}>{todo.title}</Text>
              {todo.description ? (
                <Text style={styles.desc} numberOfLines={1}>{todo.description}</Text>
              ) : null}
              <View style={styles.meta}>
                <PriorityBadge priority={todo.priority} />
                <DeadlineBadge deadline={todo.deadline} />
              </View>
            </View>
          </View>
          {onPress && <Text style={styles.arrow}>›</Text>}
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  left: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12 },
  content: { flex: 1, gap: 6 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  desc: { color: colors.textMuted, fontSize: 13 },
  meta: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  arrow: { color: colors.textMuted, fontSize: 22, marginLeft: 8 },
});
