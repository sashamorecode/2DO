import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '../../../components/ui/Screen';
import { TodoForm } from '../../../components/todo/TodoForm';
import { todosApi, CreateTodoInput } from '../../../services/todos.api';

export default function NewTodoScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  async function handleSubmit(data: CreateTodoInput) {
    const created = await todosApi.create(data);
    qc.setQueryData(['todo', created.id], created);
    qc.invalidateQueries({ queryKey: ['todos'] });
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
