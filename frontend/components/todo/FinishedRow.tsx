import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { CheckCircle2, RotateCcw, ChevronRight, Lock } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { Todo } from '../../services/todos.api';
import { PriorityBadge } from './PriorityBadge';

interface Props {
  todo: Todo;
  onReopen: () => void;
  onPress: () => void;
}

export function FinishedRow({ todo, onReopen, onPress }: Props) {
  const finishedAt = todo.completed_at ? new Date(todo.completed_at) : null;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.left}>
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
            {finishedAt && (
              <Text style={styles.finishedAt}>
                Finished {format(finishedAt, 'MMM d, h:mm a')}
              </Text>
            )}
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onReopen}
          hitSlop={8}
          style={styles.reopenBtn}
          accessibilityLabel="Reactivate task"
        >
          <RotateCcw size={16} color={colors.accentLight} strokeWidth={2.4} />
        </TouchableOpacity>
        <ChevronRight size={20} color={colors.textDim} strokeWidth={2.2} />
      </View>
    </TouchableOpacity>
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
  finishedAt: { color: colors.textDim, fontSize: 12, fontWeight: '500' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  reopenBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
