import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ChevronRight, ListChecks, Lock } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { Todo } from '../../services/todos.api';
import { PriorityBadge } from './PriorityBadge';
import { DeadlineBadge } from './DeadlineBadge';
import { TagChip } from './TagChip';
import { CompletionButton } from '../completion/CompletionButton';

import { celebrate } from '../completion/Celebration';

interface Props {
  todo: Todo;
  onComplete?: (id: string) => void;
  onPress?: (todo: Todo) => void;
  readOnly?: boolean;
  actionTitle?: string;
  onActionPress?: () => void;
  actionLoading?: boolean;
  dragHandle?: React.ReactNode;
}

export function TodoCard({
  todo,
  onComplete,
  onPress,
  readOnly,
  actionTitle,
  onActionPress,
  actionLoading,
  dragHandle,
}: Props) {
  const cardRef = useRef<View>(null);
  const completing = useRef(false);
  const steps = todo.steps ?? [];

  function handleComplete() {
    if (!onComplete || completing.current) return;
    completing.current = true;
    let submitted = false;
    // Measuring is best-effort. Saving must still happen if native layout never replies.
    const submit = () => {
      if (submitted) return;
      submitted = true;
      clearTimeout(fallback);
      onComplete(todo.id);
    };
    const fallback = setTimeout(submit, 150);
    try {
      cardRef.current?.measureInWindow((x, y, width, height) => {
        if (submitted) return;
        try {
          if (width > 0 && height > 0) {
            celebrate({ x, y, width, height, content: (
              <View style={[styles.card, { marginBottom: 0, width, height }]}>{contents}</View>
            ) });
          }
        } catch {
          // Decorative failures must not prevent the local-first save.
        }
        submit();
      });
    } catch {
      submit();
    }
  }

  const contents = (<>
          <View style={styles.left}>
            {!readOnly && <CompletionButton onComplete={handleComplete} accessibilityLabel={`Complete ${todo.title}`} />}
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
              {todo.tags.length > 0 ? (
                <View style={styles.tagsRow}>
                  {todo.tags.map((tag) => (
                    <TagChip key={tag.id} tag={tag} />
                  ))}
                </View>
              ) : null}
              <View style={styles.meta}>
                <PriorityBadge priority={todo.priority} />
                <DeadlineBadge deadline={todo.deadline} />
                {steps.length > 0 ? (
                  <View style={styles.stepProgress}>
                    <ListChecks size={12} color={colors.textMuted} strokeWidth={2.2} />
                    <Text style={styles.stepProgressText}>
                      {steps.filter((step) => step.completed).length}/{steps.length} steps
                    </Text>
                  </View>
                ) : null}
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
            {dragHandle ?? (onPress && <ChevronRight size={20} color={colors.textDim} strokeWidth={2.2} />)}
          </View>
  </>);

  return (
    <TouchableOpacity
      ref={cardRef as any}
      style={styles.card}
      onPress={() => onPress?.(todo)}
      activeOpacity={0.85}
      disabled={!onPress}
      accessible={dragHandle ? false : undefined}
    >
      {contents}
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
  },
  left: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12 },
  content: { flex: 1, gap: 6 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  desc: { color: colors.textMuted, fontSize: 13 },
  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  stepProgress: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepProgressText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
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
