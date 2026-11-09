import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckCircle2, RotateCcw, ChevronRight, Lock } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { Todo } from '../../services/todos.api';
import { PriorityBadge } from './PriorityBadge';
import { TagChip } from './TagChip';
import { formatDateTimeInTimeZone } from '../../services/timezone';
import { useAuthStore } from '../../store/authStore';

interface Props {
  todo: Todo;
  onReopen?: () => void;
  onPress?: () => void;
  ownerLabel?: string;
}

export function FinishedRow({ todo, onReopen, onPress, ownerLabel }: Props) {
  const timezone = useAuthStore((s) => s.user?.timezone);
  const finishedAt = todo.completed_at
    ? formatDateTimeInTimeZone(todo.completed_at, timezone, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;
  return (
    <View style={styles.card}>
      <TouchableOpacity accessibilityRole={onPress ? "button" : undefined} accessibilityHint="Opens task details" style={styles.left} onPress={onPress} activeOpacity={0.85} disabled={!onPress}>
        <CheckCircle2 size={22} color={colors.success} strokeWidth={2.2} />
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {todo.title}
            </Text>
            {todo.is_private && <Lock size={12} color={colors.textDim} strokeWidth={2.4} />}
          </View>
          <View style={styles.meta}>
            <PriorityBadge priority={todo.priority} />
            {todo.tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
            {ownerLabel ? <Text style={styles.ownerLabel}>{ownerLabel}</Text> : null}
            {finishedAt && (
              <Text style={styles.finishedAt}>
                Finished {finishedAt}
              </Text>
            )}
          </View>
        </View>
        {onPress ? <ChevronRight size={20} color={colors.textDim} strokeWidth={2.2} /> : null}
      </TouchableOpacity>
      {(onReopen || onPress) ? (
        <View style={styles.actions}>
          {onReopen ? (
            <TouchableOpacity
              onPress={onReopen}
              accessibilityRole="button"
              style={styles.reopenBtn}
              accessibilityLabel={`Reactivate task: ${todo.title}`}
            >
              <RotateCcw size={16} color={colors.accentLight} strokeWidth={2.4} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
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
    opacity: 0.92,
  },
  left: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12 },
  content: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
    textDecorationLine: 'line-through',
    textDecorationColor: colors.textDim,
  },
  meta: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  ownerLabel: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  finishedAt: { color: colors.textDim, fontSize: 12, fontWeight: '500' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  reopenBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
