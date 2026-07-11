import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react-native';
import { colors } from '../../../constants/colors';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Screen } from '../../../components/ui/Screen';
import { DateTimeField } from '../../../components/ui/DateTimeField';
import { friendsApi } from '../../../services/friends.api';
import { todosApi } from '../../../services/todos.api';
import { bodyDoubleApi } from '../../../services/bodyDouble.api';
import { serializeTodoDateInTimeZone, parseTodoDateInTimeZone, hasMeaningfulTodoTime } from '../../../services/timezone';
import { useAuthStore } from '../../../store/authStore';

const schema = z.object({
  friendIds: z.array(z.string()).min(1, 'Select at least one friend'),
  message: z.string().optional(),
  scheduledAt: z.date(),
  scheduledHasTime: z.boolean(),
});

type FormData = z.input<typeof schema>;

export default function BodyDoubleRequestScreen() {
  const { todoId } = useLocalSearchParams<{ todoId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const timezone = useAuthStore((s) => s.user?.timezone);

  const { data: todo } = useQuery({
    queryKey: ['todo', todoId],
    queryFn: () => todosApi.get(todoId!),
    enabled: !!todoId,
  });

  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: friendsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return bodyDoubleApi.createSession({
        todo_id: todoId,
        invitee_ids: data.friendIds,
        message: data.message?.trim() || undefined,
        scheduled_at: serializeTodoDateInTimeZone(
          data.scheduledAt,
          data.scheduledHasTime,
          'morning',
          timezone
        )!,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['body-double-sessions'] });
      qc.invalidateQueries({ queryKey: ['todos'] });
      qc.invalidateQueries({ queryKey: ['todo', todoId] });
      router.back();
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.error ?? 'Failed to send invitations.');
    },
  });

  const defaultPlannedAt = todo?.planned_at
    ? parseTodoDateInTimeZone(todo.planned_at, timezone)
    : null;

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      friendIds: [],
      message: '',
      scheduledAt: defaultPlannedAt ?? new Date(),
      scheduledHasTime: defaultPlannedAt
        ? hasMeaningfulTodoTime(todo?.planned_at ?? null, 'morning', timezone)
        : false,
    },
  });

  const { friendIds: selectedFriendIds, scheduledAt, scheduledHasTime } = watch();

  function toggleFriend(id: string) {
    setValue(
      'friendIds',
      selectedFriendIds.includes(id)
        ? selectedFriendIds.filter((fid) => fid !== id)
        : [...selectedFriendIds, id],
      { shouldDirty: true }
    );
  }

  const dateDiffers =
    todo?.planned_at &&
    scheduledAt &&
    parseTodoDateInTimeZone(todo.planned_at, timezone)?.toDateString() !==
      scheduledAt.toDateString();

  if (!todoId) {
    return (
      <Screen style={styles.screen}>
        <Text style={styles.emptyText}>No task specified.</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {todo && (
          <View style={styles.taskRef}>
            <Text style={styles.taskRefLabel}>Task</Text>
            <Text style={styles.taskRefTitle}>{todo.title}</Text>
          </View>
        )}

        <Text style={styles.label}>Select Friends</Text>
        {friendsLoading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : friends.length === 0 ? (
          <Text style={styles.emptyText}>
            No friends yet. Add friends from the Friends tab first.
          </Text>
        ) : (
          <View style={styles.friendsList}>
            {friends.map((f) => {
              const selected = selectedFriendIds.includes(f.user.id);
              return (
                <TouchableOpacity
                  key={f.user.id}
                  style={[styles.friendChip, selected && styles.friendChipSelected]}
                  onPress={() => toggleFriend(f.user.id)}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Check size={12} color={colors.text} strokeWidth={3} />}
                  </View>
                  <Text style={[styles.friendName, selected && styles.friendNameSelected]}>
                    {f.user.username}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {errors.friendIds && (
          <Text style={styles.errorText}>{errors.friendIds.message}</Text>
        )}

        <DateTimeField
          label="Session Date & Time"
          date={scheduledAt}
          hasTime={scheduledHasTime}
          onDate={(d) => { if (d) setValue('scheduledAt', d); }}
          onHasTime={(b) => setValue('scheduledHasTime', b)}
        />

        {dateDiffers && (
          <View style={styles.dateNote}>
            <Text style={styles.dateNoteText}>
              The task's do date will be updated to match this session date.
            </Text>
          </View>
        )}

        <Controller
          control={control}
          name="message"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Message (optional)"
              value={value ?? ''}
              onChangeText={onChange}
              placeholder="Hey, let's work together! 🎯"
              multiline
              numberOfLines={3}
              style={{ height: 80, textAlignVertical: 'top' }}
            />
          )}
        />

        <Button
          title="Send Invitations"
          onPress={handleSubmit((data) => createMutation.mutate(data))}
          loading={createMutation.isPending}
          style={styles.submitBtn}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingTop: 12 },
  container: { flex: 1 },
  taskRef: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskRefLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  taskRefTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  friendsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  friendChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '22',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  friendName: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  friendNameSelected: { color: colors.text },
  errorText: { color: colors.error, fontSize: 12, marginTop: -12, marginBottom: 12 },
  emptyText: { color: colors.textDim, fontSize: 13, fontStyle: 'italic', marginBottom: 16 },
  dateNote: {
    backgroundColor: colors.warning + '18',
    borderRadius: 8,
    padding: 10,
    marginTop: -10,
    marginBottom: 18,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  dateNoteText: { color: colors.warning, fontSize: 12, fontWeight: '500' },
  submitBtn: { marginTop: 8, marginBottom: 32 },
});
