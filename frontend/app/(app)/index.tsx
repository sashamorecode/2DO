import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  Plus,
  PartyPopper,
  Users as UsersIcon,
  CalendarDays,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { Screen } from '../../components/ui/Screen';
import { TodoCard } from '../../components/todo/TodoCard';
import { FinishedRow } from '../../components/todo/FinishedRow';
import { todosApi, Todo } from '../../services/todos.api';
import { feedApi, FriendFeedItem } from '../../services/feed.api';
import { tagsApi, Tag } from '../../services/tags.api';
import { bodyDoubleApi, BodyDoubleSession } from '../../services/bodyDouble.api';
import { useAuthStore } from '../../store/authStore';
import { PRIORITIES, PRIORITY_ORDER } from '../../constants/priorities';
import { SessionCard } from '../../components/bodyDouble/SessionCard';
import { formatDateTimeInTimeZone } from '../../services/timezone';

type PrimaryTab = 'mine' | 'friends';
type SecondaryTab = 'active' | 'calendar' | 'done';
type UrgencyFilter = 'all' | 'A' | 'B' | 'C';

interface TaskItem {
  todo: Todo;
  owner?: FriendFeedItem['user'];
}

interface PokeTaskInput {
  todoId: string;
  ownerName?: string | null;
  title: string;
}

interface CalendarSection {
  key: string;
  title: string;
  subtitle: string;
  data: TaskItem[];
}

export default function TasksScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const timezone = user?.timezone;

  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('mine');
  const [secondaryTab, setSecondaryTab] = useState<SecondaryTab>('active');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [filterVisible, setFilterVisible] = useState(false);

  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    enabled: primaryTab === 'mine',
  });

  const myPendingQuery = useQuery({
    queryKey: ['todos', 'pending'],
    queryFn: () => todosApi.list({ status: 'pending' }),
    enabled: primaryTab === 'mine' && (secondaryTab === 'active' || secondaryTab === 'calendar'),
  });

  const myDoneQuery = useQuery({
    queryKey: ['todos', 'completed'],
    queryFn: () => todosApi.list({ status: 'completed' }),
    enabled: primaryTab === 'mine' && secondaryTab === 'done',
  });

  const friendsPendingQuery = useQuery({
    queryKey: ['feed', 'pending'],
    queryFn: () => feedApi.get({ status: 'pending' }),
    enabled: primaryTab === 'friends' && (secondaryTab === 'active' || secondaryTab === 'calendar'),
    refetchInterval: 30_000,
  });

  const friendsDoneQuery = useQuery({
    queryKey: ['feed', 'completed'],
    queryFn: () => feedApi.get({ status: 'completed' }),
    enabled: primaryTab === 'friends' && secondaryTab === 'done',
    refetchInterval: 30_000,
  });

  const bodyDoubleSessionsQuery = useQuery({
    queryKey: ['body-double-sessions'],
    queryFn: () => bodyDoubleApi.listSessions(),
    enabled: secondaryTab === 'calendar',
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => todosApi.complete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['todos', 'pending'] });
      const prev = queryClient.getQueryData<Todo[]>(['todos', 'pending']);
      queryClient.setQueryData<Todo[]>(['todos', 'pending'], (old) => old?.filter((todo) => todo.id !== id) ?? []);
      return { prev };
    },
    onError: (_error, _id, ctx) => {
      queryClient.setQueryData(['todos', 'pending'], ctx?.prev);
      Alert.alert('Error', 'Failed to complete task');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => todosApi.reopen(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['todos', 'completed'] });
      const prev = queryClient.getQueryData<Todo[]>(['todos', 'completed']);
      queryClient.setQueryData<Todo[]>(
        ['todos', 'completed'],
        (old) => old?.filter((todo) => todo.id !== id) ?? []
      );
      return { prev };
    },
    onError: (_error, _id, ctx) => {
      queryClient.setQueryData(['todos', 'completed'], ctx?.prev);
      Alert.alert('Error', 'Could not reactivate this task');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const pokeMutation = useMutation({
    mutationFn: ({ todoId }: PokeTaskInput) => todosApi.poke(todoId),
    onSuccess: (_data, variables) => {
      const ownerName = variables.ownerName ?? 'your friend';
      Alert.alert('Poke sent', `${ownerName} got a reminder for "${variables.title}".`);
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.error ?? 'Could not send poke');
    },
  });

  const myPending = myPendingQuery.data ?? [];
  const myDone = myDoneQuery.data ?? [];
  const friendsPending = friendsPendingQuery.data ?? [];
  const friendsDone = friendsDoneQuery.data ?? [];
  const tags = tagsQuery.data ?? [];
  const pokingTodoId = pokeMutation.isPending ? pokeMutation.variables?.todoId ?? null : null;

  const myPendingFiltered = useMemo(
    () => filterTodos(myPending, urgencyFilter, selectedTagIds),
    [myPending, urgencyFilter, selectedTagIds]
  );

  const myDoneFiltered = useMemo(
    () => filterTodos(myDone, urgencyFilter, selectedTagIds),
    [myDone, urgencyFilter, selectedTagIds]
  );

  const importanceGroups = useMemo(
    () =>
      PRIORITY_ORDER.map((priority) => ({
        priority,
        meta: PRIORITIES[priority],
        data: sortByAnchorDate(myPendingFiltered.filter((todo) => todo.priority === priority)),
      })).filter((group) => group.data.length > 0),
    [myPendingFiltered]
  );

  const friendsActiveGroups = useMemo(
    () => friendsPending.filter((entry) => entry.todos.length > 0),
    [friendsPending]
  );

  const myCalendarSections = useMemo(
    () => buildCalendarSections(myPendingFiltered.map((todo) => ({ todo })), timezone),
    [myPendingFiltered, timezone]
  );

  const friendsCalendarSections = useMemo(
    () => buildCalendarSections(flattenFeed(friendsPending), timezone),
    [friendsPending, timezone]
  );

  // Build session calendar sections for body doubling
  const sessionCalendarSections = useMemo(() => {
    const sessions = bodyDoubleSessionsQuery.data ?? [];
    if (sessions.length === 0) return [];

    const groups = new Map<string, { data: BodyDoubleSession[]; sortTime: number; title: string; subtitle: string }>();

    for (const session of sessions) {
      const anchor = session.scheduled_at;
      const key = anchor ? getDayKey(anchor, timezone) : 'undated';
      const sortTime = anchor ? new Date(anchor).getTime() : Number.MAX_SAFE_INTEGER;

      if (!groups.has(key)) {
        groups.set(key, {
          data: [],
          sortTime,
          title: anchor ? getDayTitle(anchor, timezone) : 'No date assigned',
          subtitle: anchor ? getDaySubtitle(anchor, timezone) : '',
        });
      }

      groups.get(key)?.data.push(session);
    }

    return [...groups.entries()]
      .sort((left, right) => left[1].sortTime - right[1].sortTime)
      .map(([key, value]) => ({
        key: `bd-${key}`,
        title: value.title,
        subtitle: value.subtitle,
        data: value.data,
      }));
  }, [bodyDoubleSessionsQuery.data, timezone]);

  const friendDoneItems = useMemo(
    () =>
      flattenFeed(friendsDone).sort(
        (left, right) => getCompletionTime(right.todo) - getCompletionTime(left.todo)
      ),
    [friendsDone]
  );

  const title = primaryTab === 'mine' ? 'My Tasks' : 'Friends Tasks';
  const subtitle = getSubtitle(primaryTab, secondaryTab, user?.username ?? null);

  const onRefresh = () => {
    if (primaryTab === 'mine' && secondaryTab === 'done') {
      myDoneQuery.refetch();
      return;
    }

    if (primaryTab === 'mine') {
      tagsQuery.refetch();
      myPendingQuery.refetch();
      return;
    }

    if (secondaryTab === 'done') {
      friendsDoneQuery.refetch();
      return;
    }

    friendsPendingQuery.refetch();
  };

  return (
    <Screen>
      <View style={styles.heroCard}>
        <View style={styles.heroGlowLarge} />
        <View style={styles.heroGlowSmall} />
        <Text style={styles.heroKicker}>Task Room</Text>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroSubtitle}>{subtitle}</Text>
          </View>
          {primaryTab === 'mine' ? (
            <TouchableOpacity onPress={() => router.push('/(app)/todo/new')} style={styles.addBtn}>
              <Plus size={16} color={colors.text} strokeWidth={2.6} />
              <Text style={styles.addBtnText}>New Task</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TabStrip
          value={primaryTab}
          onChange={(value) => setPrimaryTab(value as PrimaryTab)}
          options={[
            { value: 'mine', label: 'My Tasks' },
            { value: 'friends', label: 'Friends Tasks' },
          ]}
          variant="primary"
        />

        <TabStrip
          value={secondaryTab}
          onChange={(value) => setSecondaryTab(value as SecondaryTab)}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'calendar', label: 'Calendar' },
            { value: 'done', label: 'Done' },
          ]}
          variant="secondary"
        />

        {primaryTab === 'mine' ? (
          <>
            <TouchableOpacity
              onPress={() => setFilterVisible((prev) => !prev)}
              style={styles.filterToggle}
            >
              <SlidersHorizontal size={14} color={filterVisible ? colors.accent : colors.textMuted} />
              <Text style={[styles.filterToggleText, filterVisible && styles.filterToggleTextActive]}>
                Filter
              </Text>
              {(urgencyFilter !== 'all' || selectedTagIds.length > 0) ? (
                <View style={styles.filterActiveDot} />
              ) : null}
            </TouchableOpacity>
            {filterVisible ? (
              <FilterBar
                urgencyFilter={urgencyFilter}
                onUrgencyFilter={setUrgencyFilter}
                selectedTagIds={selectedTagIds}
                tags={tags}
                onToggleTag={(tagId) =>
                  setSelectedTagIds((prev) =>
                    prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
                  )
                }
                onClearTags={() => setSelectedTagIds([])}
              />
            ) : null}
          </>
        ) : null}
      </View>

      {primaryTab === 'mine' && secondaryTab === 'active' ? (
        <PriorityBoard
          groups={importanceGroups}
          loading={myPendingQuery.isLoading}
          onRefresh={onRefresh}
          onComplete={(id) => completeMutation.mutate(id)}
          onPress={(todo) => router.push(`/(app)/todo/${todo.id}`)}
        />
      ) : null}

      {primaryTab === 'friends' && secondaryTab === 'active' ? (
        <FriendsBoard
          feed={friendsActiveGroups}
          loading={friendsPendingQuery.isLoading}
          onRefresh={onRefresh}
          pokingTodoId={pokingTodoId}
          onPoke={(todoId, ownerName, title) => pokeMutation.mutate({ todoId, ownerName, title })}
        />
      ) : null}

      {primaryTab === 'mine' && secondaryTab === 'calendar' ? (
        <CalendarBoard
          sections={myCalendarSections}
          loading={myPendingQuery.isLoading || bodyDoubleSessionsQuery.isLoading}
          onRefresh={onRefresh}
          onComplete={(id) => completeMutation.mutate(id)}
          onPress={(todo) => router.push(`/(app)/todo/${todo.id}`)}
          sessionSections={sessionCalendarSections}
        />
      ) : null}

      {primaryTab === 'friends' && secondaryTab === 'calendar' ? (
        <CalendarBoard
          sections={friendsCalendarSections}
          loading={friendsPendingQuery.isLoading || bodyDoubleSessionsQuery.isLoading}
          onRefresh={onRefresh}
          readOnly
          pokingTodoId={pokingTodoId}
          onPoke={(item) =>
            pokeMutation.mutate({
              todoId: item.todo.id,
              ownerName: item.owner?.username,
              title: item.todo.title,
            })
          }
          sessionSections={sessionCalendarSections}
        />
      ) : null}

      {primaryTab === 'mine' && secondaryTab === 'done' ? (
        <DoneBoard
          items={myDoneFiltered.map((todo) => ({ todo }))}
          loading={myDoneQuery.isLoading}
          onRefresh={onRefresh}
          onReopen={(id) => reopenMutation.mutate(id)}
          onPress={(todo) => router.push(`/(app)/todo/${todo.id}`)}
        />
      ) : null}

      {primaryTab === 'friends' && secondaryTab === 'done' ? (
        <DoneBoard
          items={friendDoneItems}
          loading={friendsDoneQuery.isLoading}
          onRefresh={onRefresh}
          readOnly
        />
      ) : null}
    </Screen>
  );
}

function PriorityBoard({
  groups,
  loading,
  onRefresh,
  onComplete,
  onPress,
}: {
  groups: Array<{ priority: string; meta: { label: string; color: string }; data: Todo[] }>;
  loading: boolean;
  onRefresh: () => void;
  onComplete: (id: string) => void;
  onPress: (todo: Todo) => void;
}) {
  return (
    <FlatList
      data={groups}
      keyExtractor={(group) => group.priority}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      renderItem={({ item: group }) => (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: group.meta.color }]}>{group.meta.label}</Text>
            <Text style={styles.sectionCount}>{group.data.length}</Text>
          </View>
          {group.data.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onComplete={onComplete}
              onPress={onPress}
            />
          ))}
        </View>
      )}
      ListEmptyComponent={
        !loading ? (
          <EmptyState
            icon={<PartyPopper size={56} color={colors.accentLight} strokeWidth={1.6} />}
            title="All clear"
            description="No active tasks right now. Add one and it will land here."
          />
        ) : null
      }
    />
  );
}

function FriendsBoard({
  feed,
  loading,
  onRefresh,
  onPoke,
  pokingTodoId,
}: {
  feed: FriendFeedItem[];
  loading: boolean;
  onRefresh: () => void;
  onPoke: (todoId: string, ownerName: string | null | undefined, title: string) => void;
  pokingTodoId: string | null;
}) {
  return (
    <FlatList
      data={feed}
      keyExtractor={(item) => item.user.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      renderItem={({ item }) => (
        <View style={styles.friendPanel}>
          <View style={styles.friendPanelHeader}>
            <Text style={styles.friendPanelName}>{item.user.username ?? 'Unnamed friend'}</Text>
            <Text style={styles.friendPanelCount}>{item.todos.length} active</Text>
          </View>
          {sortByAnchorDate(item.todos).map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              readOnly
              actionTitle="Poke"
              actionLoading={pokingTodoId === todo.id}
              onActionPress={() => onPoke(todo.id, item.user.username, todo.title)}
            />
          ))}
        </View>
      )}
      ListEmptyComponent={
        !loading ? (
          <EmptyState
            icon={<UsersIcon size={56} color={colors.accentLight} strokeWidth={1.6} />}
            title="Nothing shared yet"
            description="When your friends have public active tasks, they will show up here."
          />
        ) : null
      }
    />
  );
}

function CalendarBoard({
  sections,
  loading,
  onRefresh,
  onComplete,
  onPress,
  readOnly,
  onPoke,
  pokingTodoId,
  sessionSections,
}: {
  sections: CalendarSection[];
  loading: boolean;
  onRefresh: () => void;
  onComplete?: (id: string) => void;
  onPress?: (todo: Todo) => void;
  readOnly?: boolean;
  onPoke?: (item: TaskItem) => void;
  pokingTodoId?: string | null;
  sessionSections?: Array<{ key: string; title: string; subtitle: string; data: BodyDoubleSession[] }>;
}) {
  // Merge task sections with session sections, interleaved by key
  const allSections = useMemo(() => {
    const result: Array<{ key: string; title: string; subtitle: string; tasks: TaskItem[]; sessions: BodyDoubleSession[] }> = [];
    const byKey = new Map<string, (typeof result)[0]>();

    // Add task sections
    for (const sec of sections) {
      const entry = { key: sec.key, title: sec.title, subtitle: sec.subtitle, tasks: sec.data, sessions: [] as BodyDoubleSession[] };
      byKey.set(sec.key, entry);
      result.push(entry);
    }

    // Merge session sections — strip 'bd-' prefix to match task section keys
    if (sessionSections) {
      for (const ss of sessionSections) {
        const dateKey = ss.key.replace(/^bd-/, '');
        const existing = byKey.get(dateKey);
        if (existing) {
          existing.sessions = ss.data;
        } else {
          const entry = { key: ss.key, title: ss.title, subtitle: ss.subtitle, tasks: [], sessions: ss.data };
          byKey.set(dateKey, entry);
          result.push(entry);
        }
      }
    }

    return result;
  }, [sections, sessionSections]);

  const hasContent = allSections.length > 0;

  return (
    <FlatList
      data={allSections}
      keyExtractor={(section) => section.key}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      renderItem={({ item: section }) => (
        <View style={styles.calendarSection}>
          <View style={styles.calendarHeaderRow}>
            <View>
              <Text style={styles.calendarTitle}>{section.title}</Text>
              <Text style={styles.calendarSubtitle}>{section.subtitle}</Text>
            </View>
            <View style={styles.calendarCountBadge}>
              <Text style={styles.calendarCountText}>{section.tasks.length + section.sessions.length}</Text>
            </View>
          </View>
          {section.tasks.map((item) => (
            <View key={`${item.owner?.id ?? 'mine'}-${item.todo.id}`}>
              {item.owner ? <Text style={styles.ownerBadge}>{item.owner.username ?? 'Friend'}</Text> : null}
              <TodoCard
                todo={item.todo}
                readOnly={readOnly}
                onComplete={readOnly ? undefined : onComplete}
                onPress={readOnly ? undefined : onPress}
                actionTitle={item.owner && onPoke ? 'Poke' : undefined}
                actionLoading={pokingTodoId === item.todo.id}
                onActionPress={item.owner && onPoke ? () => onPoke(item) : undefined}
              />
            </View>
          ))}
          {section.sessions.map((session) => {
            const acceptedCount = session.invitations?.filter((inv) => inv.status === 'accepted').length ?? 0;
            const totalCount = session.invitations?.length ?? 0;
            return (
              <SessionCard
                key={session.id}
                requesterName={session.requester?.username ?? 'Someone'}
                taskTitle={session.todo?.title}
                scheduledAt={formatDateTimeInTimeZone(session.scheduled_at, undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                status="scheduled"
                inviteeCount={totalCount}
                acceptedCount={acceptedCount}
              />
            );
          })}
        </View>
      )}
      ListEmptyComponent={
        !loading && !hasContent ? (
          <EmptyState
            icon={<CalendarDays size={56} color={colors.accentLight} strokeWidth={1.6} />}
            title="Calendar is empty"
            description="Tasks with do dates or deadlines will line up here by day."
          />
        ) : null
      }
    />
  );
}

function DoneBoard({
  items,
  loading,
  onRefresh,
  onReopen,
  onPress,
  readOnly,
}: {
  items: TaskItem[];
  loading: boolean;
  onRefresh: () => void;
  onReopen?: (id: string) => void;
  onPress?: (todo: Todo) => void;
  readOnly?: boolean;
}) {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => `${item.owner?.id ?? 'mine'}-${item.todo.id}`}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      renderItem={({ item }) => (
        <FinishedRow
          todo={item.todo}
          ownerLabel={item.owner?.username ?? undefined}
          onReopen={readOnly || !onReopen ? undefined : () => onReopen(item.todo.id)}
          onPress={readOnly || !onPress ? undefined : () => onPress(item.todo)}
        />
      )}
      ListEmptyComponent={
        !loading ? (
          <EmptyState
            icon={<CheckCircle2 size={56} color={colors.accentLight} strokeWidth={1.6} />}
            title="No done tasks yet"
            description={readOnly ? 'Completed public tasks from friends will collect here.' : 'Done tasks stay here so you can revisit or reopen them.'}
          />
        ) : null
      }
    />
  );
}

function TabStrip<T extends string>({
  value,
  onChange,
  options,
  variant,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  variant: 'primary' | 'secondary';
}) {
  return (
    <View style={[styles.tabRow, variant === 'secondary' && styles.subTabRow]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.tabButton,
              variant === 'primary' ? styles.primaryTabButton : styles.secondaryTabButton,
              active && (variant === 'primary' ? styles.primaryTabButtonActive : styles.secondaryTabButtonActive),
            ]}
          >
            <Text
              style={[
                styles.tabButtonLabel,
                variant === 'secondary' && styles.secondaryTabButtonLabel,
                active && styles.tabButtonLabelActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function FilterBar({
  urgencyFilter,
  onUrgencyFilter,
  tags,
  selectedTagIds,
  onToggleTag,
  onClearTags,
}: {
  urgencyFilter: UrgencyFilter;
  onUrgencyFilter: (value: UrgencyFilter) => void;
  tags: Tag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onClearTags: () => void;
}) {
  return (
    <View style={styles.filterCard}>
      <View style={styles.filterHeaderRow}>
        <Text style={styles.filterTitle}>Filter</Text>
        {selectedTagIds.length > 0 ? (
          <TouchableOpacity onPress={onClearTags}>
            <Text style={styles.clearFilterText}>Clear tags</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.filterLabel}>Urgency</Text>
      <View style={styles.filterChipRow}>
        {(['all', 'A', 'B', 'C'] as UrgencyFilter[]).map((option) => {
          const active = urgencyFilter === option;
          const label = option === 'all' ? 'All' : PRIORITIES[option].short;
          const color = option === 'all' ? colors.accentLight : PRIORITIES[option].color;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onUrgencyFilter(option)}
              style={[
                styles.filterChip,
                {
                  borderColor: color,
                  backgroundColor: active ? `${color}2E` : 'transparent',
                },
              ]}
            >
              <Text style={[styles.filterChipText, { color: active ? color : colors.textMuted }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.filterLabel}>Tags</Text>
      {tags.length === 0 ? (
        <Text style={styles.filterEmptyText}>No tags yet. Add tags while creating or editing a task.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagFilterScroll}
        >
          {tags.map((tag) => {
            const active = selectedTagIds.includes(tag.id);
            return (
              <TouchableOpacity
                key={tag.id}
                onPress={() => onToggleTag(tag.id)}
                style={[
                  styles.filterChip,
                  {
                    borderColor: tag.color,
                    backgroundColor: active ? `${tag.color}35` : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.filterChipText, { color: active ? tag.color : colors.textMuted }]}>
                  {tag.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

function filterTodos(todos: Todo[], urgency: UrgencyFilter, selectedTagIDs: string[]): Todo[] {
  return todos.filter((todo) => {
    const urgencyMatches = urgency === 'all' || todo.priority === urgency;
    if (!urgencyMatches) {
      return false;
    }

    if (selectedTagIDs.length === 0) {
      return true;
    }

    return todo.tags.some((tag) => selectedTagIDs.includes(tag.id));
  });
}

function flattenFeed(feed: FriendFeedItem[]): TaskItem[] {
  return feed.flatMap((entry) => entry.todos.map((todo) => ({ todo, owner: entry.user })));
}

function sortByAnchorDate(todos: Todo[]): Todo[] {
  return [...todos].sort((left, right) => getAnchorTime(left) - getAnchorTime(right));
}

function buildCalendarSections(items: TaskItem[], timezone?: string): CalendarSection[] {
  const groups = new Map<string, { data: TaskItem[]; sortTime: number; title: string; subtitle: string }>();

  for (const item of items) {
    const anchor = getAnchorIso(item.todo);
    const key = anchor ? getDayKey(anchor, timezone) : 'undated';
    const sortTime = anchor ? new Date(anchor).getTime() : Number.MAX_SAFE_INTEGER;

    if (!groups.has(key)) {
      groups.set(key, {
        data: [],
        sortTime,
        title: anchor ? getDayTitle(anchor, timezone) : 'No date assigned',
        subtitle: anchor ? getDaySubtitle(anchor, timezone) : 'Tasks without a do date or deadline',
      });
    }

    groups.get(key)?.data.push(item);
  }

  return [...groups.entries()]
    .sort((left, right) => left[1].sortTime - right[1].sortTime)
    .map(([key, value]) => ({
      key,
      title: value.title,
      subtitle: value.subtitle,
      data: value.data.sort((left, right) => getAnchorTime(left.todo) - getAnchorTime(right.todo)),
    }));
}

function getSubtitle(primaryTab: PrimaryTab, secondaryTab: SecondaryTab, username: string | null): string {
  if (primaryTab === 'mine' && secondaryTab === 'active') {
    return `Keep the queue visible, ${username ?? 'friend'}. Clear the urgent things first.`;
  }

  if (primaryTab === 'mine' && secondaryTab === 'calendar') {
    return 'Every dated task, arranged by the day it wants attention.';
  }

  if (primaryTab === 'mine') {
    return 'Finished tasks stay close enough to reopen without digging.';
  }

  if (secondaryTab === 'active') {
    return 'A live read on what your friends have out in the open right now.';
  }

  if (secondaryTab === 'calendar') {
    return 'See your friends\' public task dates without jumping between profiles.';
  }

  return 'Completed public tasks from friends, gathered into one quiet archive.';
}

function getAnchorIso(todo: Todo): string | null {
  const candidates = [todo.planned_at, todo.deadline].filter((value): value is string => !!value);
  if (candidates.length === 0) return null;
  return candidates.sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];
}

function getAnchorTime(todo: Todo): number {
  const anchor = getAnchorIso(todo);
  return anchor ? new Date(anchor).getTime() : Number.MAX_SAFE_INTEGER;
}

function getCompletionTime(todo: Todo): number {
  return todo.completed_at ? new Date(todo.completed_at).getTime() : 0;
}

function getDayKey(iso: string, timezone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function getDayTitle(iso: string, timezone?: string): string {
  const todayKey = getDayKey(new Date().toISOString(), timezone);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = getDayKey(tomorrow.toISOString(), timezone);
  const targetKey = getDayKey(iso, timezone);

  if (targetKey === todayKey) return 'Today';
  if (targetKey === tomorrowKey) return 'Tomorrow';

  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}

function getDaySubtitle(iso: string, timezone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

const styles = StyleSheet.create({
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 18,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    gap: 14,
  },
  heroGlowLarge: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.accent + '2A',
    top: -54,
    right: -24,
  },
  heroGlowSmall: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.priorityB + '22',
    bottom: -28,
    left: -10,
  },
  heroKicker: {
    color: colors.accentLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 11,
    fontWeight: '800',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  heroTextBlock: { flex: 1, gap: 6 },
  heroTitle: {
    color: colors.text,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderColor: colors.accentDark,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  addBtnText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg + '80',
    borderRadius: 18,
    padding: 5,
    gap: 6,
  },
  subTabRow: {
    backgroundColor: colors.surfaceAlt,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryTabButton: {
    minHeight: 44,
    paddingHorizontal: 12,
  },
  secondaryTabButton: {
    minHeight: 38,
    paddingHorizontal: 10,
  },
  primaryTabButtonActive: {
    backgroundColor: colors.text,
  },
  secondaryTabButtonActive: {
    backgroundColor: colors.accent,
  },
  tabButtonLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryTabButtonLabel: {
    fontSize: 13,
  },
  tabButtonLabelActive: {
    color: colors.bg,
  },
  filterCard: {
    backgroundColor: colors.bg + '80',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 8,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  clearFilterText: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '700',
  },
  filterLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterEmptyText: {
    color: colors.textDim,
    fontSize: 12,
    fontStyle: 'italic',
  },
  tagFilterScroll: {
    gap: 8,
    paddingRight: 6,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.bg + '80',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterToggleText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterToggleTextActive: {
    color: colors.accent,
  },
  filterActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 36,
    gap: 12,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCount: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  friendPanel: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  friendPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  friendPanelName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  friendPanelCount: {
    color: colors.accentLight,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  calendarSection: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  calendarTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  calendarSubtitle: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  calendarCountBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCountText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  ownerBadge: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 4,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginBottom: 6,
  },
  emptyDescription: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
});