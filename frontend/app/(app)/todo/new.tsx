import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '../../../components/ui/Screen';
import { TodoForm } from '../../../components/todo/TodoForm';
import { CreateTodoInput } from '../../../services/todos.api';
import { useOfflineTodoOps } from '../../../services/todos.api.offline';
import { useAuthStore } from '../../../store/authStore';
import { useOfflineStore } from '../../../store/offlineStore';

export default function NewTodoScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const refreshPending = useOfflineStore((s) => s.refreshPending);
  const { createTodo } = useOfflineTodoOps(qc, user?.id ?? '');

  async function handleSubmit(data: CreateTodoInput) {
    const created = await createTodo(data);
    qc.setQueryData(['todo', created.id], created);
    // Invalidate list to pick up the new todo (local-first handles the
    // optimistic case; this ensures the list is fresh when online).
    qc.invalidateQueries({ queryKey: ['todos'] });
    refreshPending();
    router.replace('/(app)');
  }

  return (
    <Screen style={styles.screen}>
      <TodoForm onSubmit={handleSubmit} submitLabel="Create Task" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingTop: 16 },
});
