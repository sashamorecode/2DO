import React from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../../constants/colors';
import { Screen } from '../../components/ui/Screen';
import { TodoCard } from '../../components/todo/TodoCard';
import { feedApi, FriendFeedItem } from '../../services/feed.api';

export default function FriendsFeedScreen() {
  const { data: feed = [], isLoading, refetch } = useQuery({
    queryKey: ['feed'],
    queryFn: feedApi.get,
    refetchInterval: 30_000,
  });

  const withTasks = feed.filter((f) => f.todos.length > 0);
  const allClear = feed.filter((f) => f.todos.length === 0);

  return (
    <Screen>
      <Text style={styles.screenTitle}>Friends' Tasks</Text>
      <FlatList
        data={withTasks}
        keyExtractor={(item) => item.user.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />}
        renderItem={({ item }: { item: FriendFeedItem }) => (
          <View style={styles.friendSection}>
            <View style={styles.friendHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.user.username.slice(0, 2).toUpperCase()}</Text>
              </View>
              <Text style={styles.friendName}>{item.user.username}</Text>
              <Text style={styles.taskCount}>{item.todos.length} pending</Text>
            </View>
            {item.todos.map((todo) => (
              <TodoCard key={todo.id} todo={todo} readOnly />
            ))}
          </View>
        )}
        ListHeaderComponent={
          allClear.length > 0 ? (
            <View style={styles.allClearRow}>
              <Text style={styles.allClearLabel}>✅ All clear: </Text>
              <Text style={styles.allClearNames}>{allClear.map((f) => f.user.username).join(', ')}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptyDesc}>Add friends to see their tasks and keep each other accountable.</Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 24, fontWeight: '800', color: colors.text, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  friendSection: { marginBottom: 24 },
  friendHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.accent + '33',
    borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  friendName: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
  taskCount: { color: colors.textMuted, fontSize: 12 },
  allClearRow: {
    flexDirection: 'row',
    backgroundColor: colors.success + '11',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.success + '44',
  },
  allClearLabel: { color: colors.success, fontWeight: '700', fontSize: 13 },
  allClearNames: { color: colors.text, fontSize: 13, flexShrink: 1 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  emptyDesc: { color: colors.textMuted, fontSize: 15, textAlign: 'center', paddingHorizontal: 24 },
});
