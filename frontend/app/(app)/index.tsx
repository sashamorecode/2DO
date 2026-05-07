import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { colors } from '../../constants/colors';
import { Screen } from '../../components/ui/Screen';
import { TodoCard } from '../../components/todo/TodoCard';
import { todosApi, Todo } from '../../services/todos.api';
import { useAuthStore } from '../../store/authStore';

export default function MyTasksScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const { data: todos = [], isLoading, refetch } = useQuery({
    queryKey: ['todos'],
    queryFn: () => todosApi.list({ status: 'pending' }),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => todosApi.complete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      const prev = queryClient.getQueryData<Todo[]>(['todos']);
      queryClient.setQueryData<Todo[]>(['todos'], (old) => old?.filter((t) => t.id !== id) ?? []);
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(['todos'], ctx?.prev);
      Alert.alert('Error', 'Failed to complete task');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  const grouped = [
    { priority: 'A', label: 'A — Urgent & Important', data: todos.filter((t) => t.priority === 'A') },
    { priority: 'B', label: 'B — Urgent', data: todos.filter((t) => t.priority === 'B') },
    { priority: 'C', label: 'C — Not Urgent', data: todos.filter((t) => t.priority === 'C') },
  ].filter((g) => g.data.length > 0);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {user?.username} 👋</Text>
          <Text style={styles.subtitle}>{todos.length} task{todos.length !== 1 ? 's' : ''} pending</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/(app)/todo/new')} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => clearAuth()} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={grouped}
        keyExtractor={(g) => g.priority}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />}
        renderItem={({ item: group }) => (
          <View>
            <Text style={[styles.groupHeader, { color: group.priority === 'A' ? colors.priorityA : group.priority === 'B' ? colors.priorityB : colors.priorityC }]}>
              {group.label}
            </Text>
            {group.data.map((todo) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                onComplete={(id) => completeMutation.mutate(id)}
                onPress={(t) => router.push(`/(app)/todo/${t.id}`)}
              />
            ))}
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>All clear!</Text>
              <Text style={styles.emptyDesc}>No pending tasks. Add one to get started.</Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  signOutBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  signOutText: { color: colors.textMuted, fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  groupHeader: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 8, letterSpacing: 0.5 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  emptyDesc: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
});
