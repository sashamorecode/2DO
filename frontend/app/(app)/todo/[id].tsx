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
    queryFn: () => todosApi.list().then((todos) => todos.find((t) => t.id === id)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => todosApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['todos'] });
      router.back();
    },
  });

  async function handleSubmit(data: CreateTodoInput) {
    await todosApi.update(id!, data);
    qc.invalidateQueries({ queryKey: ['todos'] });
    router.back();
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
        <Text style={styles.title}>Edit Task</Text>
        <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <TodoForm
        initialValues={{
          title: todo.title,
          description: todo.description,
          priority: todo.priority,
          deadline: todo.deadline ? new Date(todo.deadline) : null,
        }}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  deleteText: { color: colors.error, fontWeight: '700' },
});
