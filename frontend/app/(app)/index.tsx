import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  Plus,
  PartyPopper,
  Users as UsersIcon,
  CalendarDays,
  CheckCircle2,
} from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { Screen } from '../../components/ui/Screen';
import { TodoCard } from '../../components/todo/TodoCard';
import { FinishedRow } from '../../components/todo/FinishedRow';
import { todosApi, Todo } from '../../services/todos.api';
import { feedApi, FriendFeedItem } from '../../services/feed.api';
import { useAuthStore } from '../../store/authStore';
import { PRIORITIES, PRIORITY_ORDER } from '../../constants/priorities';

type Source = 'mine' | 'friends' | 'finished';
type ViewMode = 'list' | 'calendar';

export default function TasksScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuthStore();
  const [source, setSource] = useState<Source>('mine');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const myTodosQuery = useQuery({
    queryKey: ['todos'],
    queryFn: () => todosApi.list({ status: 'pending' }),
    enabled: source === 'mine',
  });

  const friendsFeedQuery = useQuery({
    queryKey: ['feed'],
    queryFn: () => feedApi.get(),
    enabled: source === 'friends',
    refetchInterval: 30_000,
  });

  const finishedQuery = useQuery({
    queryKey: ['todos', 'completed'],
    queryFn: () => todosApi.list({ status: 'completed' }),
    enabled: source === 'finished',
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

  const reopenMutation = useMutation({
    mutationFn: (id: string) => todosApi.reopen(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['todos', 'completed'] });
      const prev = queryClient.getQueryData<Todo[]>(['todos', 'completed']);
      queryClient.setQueryData<Todo[]>(
        ['todos', 'completed'],
        (old) => old?.filter((t) => t.id !== id) ?? []
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(['todos', 'completed'], ctx?.prev);
      Alert.alert('Error', 'Could not reactivate this task');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  const todos = myTodosQuery.data ?? [];
  const finishedTodos = finishedQuery.data ?? [];

  const importanceGroups = useMemo(
    () =>
      PRIORITY_ORDER.map((p) => ({
        priority: p,
        meta: PRIORITIES[p],
        data: sortByDeadline(todos.filter((t) => t.priority === p)),
      })).filter((g) => g.data.length > 0),
    [todos]
  );

  const subtitle =
    source === 'mine'
      ? `${todos.length} task${todos.length !== 1 ? 's' : ''} pending`
      : source === 'friends'
      ? "Friends open tasks"
      : `${finishedTodos.length} finished`;

  const onRefresh = () => {
    if (source === 'mine') myTodosQuery.refetch();
    else if (source === 'friends') friendsFeedQuery.refetch();
    else finishedQuery.refetch();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hey, {user?.username} 👋</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(app)/todo/new')} style={styles.addBtn}>
          <Plus size={16} color={colors.text} strokeWidth={2.6} />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <SegmentedToggle
        value={source}
        onChange={(v) => setSource(v as Source)}
        options={[
          { value: 'mine', label: 'My Tasks' },
          { value: 'friends', label: 'Friends' },
          { value: 'finished', label: 'Finished' },
        ]}
      />

      {source !== 'finished' && (
        <SegmentedToggle
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          options={[
            { value: 'list', label: 'List' },
            { value: 'calendar', label: 'Calendar' },
          ]}
          style={{ marginTop: 8 }}
        />
      )}

      {source === 'finished' ? (
        <FinishedList
          todos={finishedTodos}
          loading={finishedQuery.isLoading}
          onRefresh={onRefresh}
          onReopen={(id) => reopenMutation.mutate(id)}
          onPress={(t) => router.push(`/(app)/todo/${t.id}`)}
        />
      ) : viewMode === 'calendar' ? (
        <CalendarPlaceholder />
      ) : source === 'mine' ? (
        <FlatList
          data={importanceGroups}
          keyExtractor={(g) => g.priority}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={myTodosQuery.isLoading}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item: group }) => (
            <View>
              <Text style={[styles.groupHeader, { color: group.meta.color }]}>
                {group.meta.label}
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
            !myTodosQuery.isLoading ? (
              <View style={styles.empty}>
                <PartyPopper size={56} color={colors.accentLight} strokeWidth={1.6} />
                <Text style={styles.emptyTitle}>All clear!</Text>
                <Text style={styles.emptyDesc}>No pending tasks. Add one to get started.</Text>
              </View>
            ) : null
          }
        />
      ) : (
        <FriendsList
          feed={friendsFeedQuery.data ?? []}
          loading={friendsFeedQuery.isLoading}
          onRefresh={onRefresh}
        />
      )}
    </Screen>
  );
}

function sortByDeadline(list: Todo[]): Todo[] {
  return [...list].sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
}

interface SegmentedToggleProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  style?: any;
}

function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  style,
}: SegmentedToggleProps<T>) {
  return (
    <View style={[toggleStyles.row, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[toggleStyles.btn, active && toggleStyles.btnActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[toggleStyles.label, active && toggleStyles.labelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function FriendsList({
  feed,
  loading,
  onRefresh,
}: {
  feed: FriendFeedItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const withTasks = feed.filter((f) => f.todos.length > 0);
  return (
    <FlatList
      data={withTasks}
      keyExtractor={(item) => item.user.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      renderItem={({ item }) => (
        <View style={styles.friendSection}>
          <Text style={styles.friendName}>{item.user.username ?? 'Unnamed friend'}</Text>
          {item.todos.map((todo) => (
            <TodoCard key={todo.id} todo={todo} readOnly />
          ))}
        </View>
      )}
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <UsersIcon size={56} color={colors.accentLight} strokeWidth={1.6} />
            <Text style={styles.emptyTitle}>Nothing from friends</Text>
            <Text style={styles.emptyDesc}>
              Add friends or wait for them to share a task.
            </Text>
          </View>
        ) : null
      }
    />
  );
}

function FinishedList({
  todos,
  loading,
  onRefresh,
  onReopen,
  onPress,
}: {
  todos: Todo[];
  loading: boolean;
  onRefresh: () => void;
  onReopen: (id: string) => void;
  onPress: (todo: Todo) => void;
}) {
  return (
    <FlatList
      data={todos}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      renderItem={({ item }) => (
        <FinishedRow
          todo={item}
          onReopen={() => onReopen(item.id)}
          onPress={() => onPress(item)}
        />
      )}
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <CheckCircle2 size={56} color={colors.accentLight} strokeWidth={1.6} />
            <Text style={styles.emptyTitle}>No finished tasks yet</Text>
            <Text style={styles.emptyDesc}>Tap the check on a task to mark it done.</Text>
          </View>
        ) : null
      }
    />
  );
}

function CalendarPlaceholder() {
  return (
    <View style={styles.empty}>
      <CalendarDays size={56} color={colors.accentLight} strokeWidth={1.6} />
      <Text style={styles.emptyTitle}>Calendar view</Text>
      <Text style={styles.emptyDesc}>Coming soon.</Text>
    </View>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    borderColor: colors.accentDark,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnText: { color: '#FFF5FB', fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },
  list: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },
  groupHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  friendSection: { marginBottom: 16 },
  friendName: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 14 },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
  emptyDesc: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
});

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  btn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  btnActive: { backgroundColor: colors.accent },
  label: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  labelActive: { color: '#FFF5FB' },
});
