import React from 'react';
import { StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { colors } from '../../../constants/colors';
import { Screen } from '../../../components/ui/Screen';
import { TodoForm } from '../../../components/todo/TodoForm';
import { todosApi, CreateTodoInput } from '../../../services/todos.api';

export default function NewTodoScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  async function handleSubmit(data: CreateTodoInput) {
    await todosApi.create(data);
    qc.invalidateQueries({ queryKey: ['todos'] });
    router.back();
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
