import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../../constants/colors';
import { Screen } from '../../../components/ui/Screen';
import { TodoForm } from '../../../components/todo/TodoForm';
import { todosApi, CreateTodoInput } from '../../../services/todos.api';

export default function EditTodoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

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
        <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete task</Text>
        </TouchableOpacity>
      </View>
      <TodoForm
        initialValues={{
          title: todo.title,
          description: todo.description,
          priority: todo.priority,
          deadline: todo.deadline ? new Date(todo.deadline) : null,
          deadlineHasTime: hasMeaningfulTime(todo.deadline),
          plannedAt: todo.planned_at ? new Date(todo.planned_at) : null,
          plannedHasTime: hasMeaningfulTime(todo.planned_at),
          isPrivate: todo.is_private,
        }}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </Screen>
  );
}

function hasMeaningfulTime(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  // Treat 09:00 (planned default) and 23:59 (deadline default) as "no time set"
  const h = d.getHours();
  const m = d.getMinutes();
  return !((h === 9 && m === 0) || (h === 23 && m === 59));
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12 },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.error + '22',
  },
  deleteText: { color: colors.error, fontWeight: '700', fontSize: 13 },
});
