import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  Lock,
} from 'lucide-react-native';
import { colors } from '../../../../constants/colors';
import { Screen } from '../../../../components/ui/Screen';
import { PriorityBadge } from '../../../../components/todo/PriorityBadge';
import { TagChip } from '../../../../components/todo/TagChip';
import { feedApi } from '../../../../services/feed.api';
import {
  formatDateTimeInTimeZone,
  hasMeaningfulTodoTime,
} from '../../../../services/timezone';
import { useAuthStore } from '../../../../store/authStore';

export default function FriendTodoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const timezone = useAuthStore((s) => s.user?.timezone);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['friend-todo', id],
    queryFn: () => feedApi.getTodo(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.errorTitle}>Task unavailable</Text>
        <Text style={styles.errorText}>
          It may have been made private or removed.
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          style={styles.retryBtn}
          disabled={isRefetching}
        >
          <Text style={styles.retryText}>
            {isRefetching ? 'Retrying…' : 'Try again'}
          </Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  const { todo, owner } = data;
  const ownerName = owner.username ?? 'Friend';
  const initials = ownerName.slice(0, 2).toUpperCase();

  const dueText = todo.deadline
    ? formatTodoDate(todo.deadline, 'end', timezone)
    : null;
  const doText = todo.planned_at
    ? formatTodoDate(todo.planned_at, 'morning', timezone)
    : null;
  const completedText = todo.completed_at
    ? formatDateTimeInTimeZone(todo.completed_at, timezone, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.ownerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.ownerTextBlock}>
            <Text style={styles.ownerLabel}>Shared by</Text>
            <Text style={styles.ownerName}>{ownerName}</Text>
          </View>
          <View style={styles.readOnlyBadge}>
            <Eye size={12} color={colors.accentLight} strokeWidth={2.4} />
            <Text style={styles.readOnlyText}>Read-only</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{todo.title}</Text>

          <View style={styles.badgeRow}>
            <PriorityBadge priority={todo.priority} />
            {todo.status === 'completed' ? (
              <View style={styles.doneBadge}>
                <CheckCircle2 size={12} color={colors.success} strokeWidth={2.6} />
                <Text style={styles.doneText}>Completed</Text>
              </View>
            ) : null}
          </View>

          {todo.description ? (
            <Text style={styles.description}>{todo.description}</Text>
          ) : (
            <Text style={styles.placeholder}>No description provided.</Text>
          )}

          {todo.tags.length > 0 ? (
            <View style={styles.tagsRow}>
              {todo.tags.map((tag) => (
                <TagChip key={tag.id} tag={tag} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <InfoRow
            icon={<Clock size={16} color={colors.textMuted} strokeWidth={2.2} />}
            label="Due date"
            value={dueText}
            fallback="No due date"
          />
          <InfoRow
            icon={<CalendarDays size={16} color={colors.textMuted} strokeWidth={2.2} />}
            label="Do date"
            value={doText}
            fallback="No do date"
          />
          {completedText ? (
            <InfoRow
              icon={<CheckCircle2 size={16} color={colors.success} strokeWidth={2.2} />}
              label="Completed"
              value={completedText}
            />
          ) : null}
          {todo.is_private ? (
            <InfoRow
              icon={<Lock size={16} color={colors.textMuted} strokeWidth={2.2} />}
              label="Visibility"
              value="Private"
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function formatTodoDate(
  iso: string,
  defaultTime: 'morning' | 'end',
  timezone?: string | null
): string {
  const withTime = hasMeaningfulTodoTime(iso, defaultTime, timezone);
  return formatDateTimeInTimeZone(
    iso,
    timezone,
    withTime
      ? {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }
      : {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }
  );
}

function InfoRow({
  icon,
  label,
  value,
  fallback,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  fallback?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.infoTextBlock}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={value ? styles.infoValue : styles.infoValueMuted}>
          {value ?? fallback ?? '—'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '33',
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accentLight, fontWeight: '800', fontSize: 15 },
  ownerTextBlock: { flex: 1 },
  ownerLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ownerName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.accent + '22',
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  readOnlyText: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.success + '22',
  },
  doneText: { color: colors.success, fontWeight: '800', fontSize: 12 },
  description: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  placeholder: {
    color: colors.textDim,
    fontSize: 14,
    fontStyle: 'italic',
  },
  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextBlock: { flex: 1 },
  infoLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  infoValueMuted: { color: colors.textMuted, fontSize: 15, fontStyle: 'italic' },
  errorTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accentDark,
  },
  retryText: { color: colors.text, fontWeight: '800', fontSize: 14 },
});
