import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react-native';
import { colors } from '../../../constants/colors';
import { Screen } from '../../../components/ui/Screen';
import { TodoForm } from '../../../components/todo/TodoForm';
import { todosApi, CreateTodoInput } from '../../../services/todos.api';
import { hasMeaningfulTodoTime, parseTodoDateInTimeZone } from '../../../services/timezone';
import { useAuthStore } from '../../../store/authStore';

export default function EditTodoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const timezone = useAuthStore((s) => s.user?.timezone);

  const { data: todo, isLoading } = useQuery({
    queryKey: ['todo', id],
    queryFn: () => todosApi.get(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => todosApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['todos'] });
      router.replace('/(app)');
    },
  });

  async function handleSubmit(data: CreateTodoInput) {
    await todosApi.update(id!, data);
    qc.invalidateQueries({ queryKey: ['todos'] });
    qc.invalidateQueries({ queryKey: ['todo', id] });
    router.replace('/(app)');
  }

  function confirmDelete() {
    Alert.alert('Delete Task', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  }

  if (isLoading || !todo) return null;

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push(`/(app)/body-double/request?todoId=${id}`)}
          style={styles.bdBtn}
        >
          <Users size={16} color={colors.accentLight} strokeWidth={2.2} />
          <Text style={styles.bdText}>Request Body Double</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete task</Text>
        </TouchableOpacity>
      </View>
      <TodoForm
        initialValues={{
          title: todo.title,
          description: todo.description,
          priority: todo.priority,
          tagIds: todo.tags.map((tag) => tag.id),
          deadline: parseTodoDateInTimeZone(todo.deadline, timezone),
          deadlineHasTime: hasMeaningfulTodoTime(todo.deadline, 'end', timezone),
          plannedAt: parseTodoDateInTimeZone(todo.planned_at, timezone),
          plannedHasTime: hasMeaningfulTodoTime(todo.planned_at, 'morning', timezone),
          isPrivate: todo.is_private,
        }}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12, gap: 8 },
  bdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.accent + '22',
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  bdText: { color: colors.accentLight, fontWeight: '700', fontSize: 13 },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.error + '22',
  },
  deleteText: { color: colors.error, fontWeight: '700', fontSize: 13 },
});
