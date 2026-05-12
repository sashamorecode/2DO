import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { ChevronRight, Lock } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { PRIORITIES } from '../../constants/priorities';
import { Todo } from '../../services/todos.api';
import { PriorityBadge } from './PriorityBadge';
import { DeadlineBadge } from './DeadlineBadge';
import { CompletionButton } from '../completion/CompletionButton';
import { playCompletionSound } from '../completion/CompletionSound';
import { celebrate } from '../completion/Celebration';

interface Props {
  todo: Todo;
  onComplete?: (id: string) => void;
  onPress?: (todo: Todo) => void;
  readOnly?: boolean;
  actionTitle?: string;
  onActionPress?: () => void;
  actionLoading?: boolean;
}

// Total drama window. The card collapses around the BURST_AT mark; the
// celebration overlay (mounted at the app root, so it survives unmount)
// keeps animating shards for ~1700ms regardless.
const WINDUP_MS = 270;
const BURST_AT = 300;
const TOTAL_MS = 1000;

export function TodoCard({
  todo,
  onComplete,
  onPress,
  readOnly,
  actionTitle,
  onActionPress,
  actionLoading,
}: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);
  const heightFactor = useSharedValue(1); // collapses the layout slot at the end
  const cardRef = useRef<View>(null);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: heightFactor.value }],
    opacity: heightFactor.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { rotateZ: `${rotate.value}deg` },
    ],
  }));

  function notifyParent() {
    onComplete?.(todo.id);
  }

  function fireBurst() {
    const accent = PRIORITIES[todo.priority].color;
    try {
      cardRef.current?.measure((_x,_y, w, h, px, py) => {
        celebrate(px + w / 2, py + h, accent);
      });
    } catch {
      // measure can fail if the view isn't laid out yet — celebration is non-critical
    }
  }

  function handleComplete() {
    playCompletionSound();

    // Phase 1 — anticipation: card grows, wiggles, holds opacity.
    scale.value = withSequence(
      withTiming(1.05, { duration: WINDUP_MS, easing: Easing.out(Easing.cubic) }),
      // Phase 2 — burst: tiny snap up, then collapse to 0 as shards take over.
      withTiming(1.14, { duration: 80, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: TOTAL_MS - BURST_AT - 80, easing: Easing.in(Easing.cubic) })
    );
    rotate.value = withSequence(
      withTiming(-3, { duration: 90 }),
      withTiming(4, { duration: 90 }),
      withTiming(-1.5, { duration: 60 }),
      withTiming(0, { duration: 40 }),
      withTiming(0, { duration: TOTAL_MS - WINDUP_MS })
    );
    opacity.value = withDelay(
      BURST_AT,
      withTiming(0, { duration: 240, easing: Easing.in(Easing.cubic) })
    );

    // Phase 3 — collapse the layout slot once the visual is gone, so the
    // remaining cards slide up smoothly instead of jumping.
    heightFactor.value = withDelay(
      TOTAL_MS - 60,
      withTiming(0, { duration: 220, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(notifyParent)();
      })
    );

    // Phase 4 — the actual shatter overlay fires at the burst moment.
    setTimeout(fireBurst, BURST_AT);
  }

  return (
    <Animated.View style={wrapperStyle}>
      <Animated.View style={cardStyle}>
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
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={2}>{todo.title}</Text>
                {todo.is_private && (
                  <Lock size={12} color={colors.textDim} strokeWidth={2.4} />
                )}
              </View>
              {todo.description ? (
                <Text style={styles.desc} numberOfLines={1}>{todo.description}</Text>
              ) : null}
              <View style={styles.meta}>
                <PriorityBadge priority={todo.priority} />
                <DeadlineBadge deadline={todo.deadline} />
              </View>
            </View>
          </View>
          <View style={styles.right}> 
            {onActionPress && actionTitle ? (
              <TouchableOpacity
                style={styles.actionChip}
                onPress={onActionPress}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={styles.actionChipLabel}>{actionTitle}</Text>
                )}
              </TouchableOpacity>
            ) : null}
            {onPress && <ChevronRight size={20} color={colors.textDim} strokeWidth={2.2} />}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
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
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  desc: { color: colors.textMuted, fontSize: 13 },
  meta: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  actionChip: {
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
