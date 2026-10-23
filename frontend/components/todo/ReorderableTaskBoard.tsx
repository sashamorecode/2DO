import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GripVertical } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import type { Todo } from '../../services/todos.api';
import { dragTarget, moveTask } from '../../services/todoOrder';
import { TodoCard } from './TodoCard';

type Group = { priority: string; meta: { label: string; color: string }; data: Todo[] };

type Drag = {
  group: Group;
  from: number;
  to: number;
  heights: number[];
  startScroll: number;
  dy: number;
  distance: number;
  pointerY: number;
};

interface Props {
  groups: Group[];
  loading: boolean;
  onRefresh: () => void;
  onComplete: (id: string) => void;
  onPress: (todo: Todo) => void;
  onReorder: (ids: string[]) => void;
  empty: React.ReactNode;
}

export function ReorderableTaskBoard({ groups, loading, onRefresh, onComplete, onPress, onReorder, empty }: Props) {
  const scroll = useRef<ScrollView>(null);
  const viewportRef = useRef<View>(null);
  const heights = useRef(new Map<string, number>());
  const offset = useRef(0);
  const contentHeight = useRef(0);
  const viewport = useRef({ top: 0, height: 0 });
  const animation = useRef<number | undefined>(undefined);
  const current = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(animation.current ?? 0);
    current.current = null;
    setDrag(null);
  }, []);
  useEffect(() => () => cancelAnimationFrame(animation.current ?? 0), []);
  useEffect(() => {
    const active = current.current;
    if (active && !groups.some((group) => group.priority === active.group.priority &&
      group.data.map((todo) => todo.id).join() === active.group.data.map((todo) => todo.id).join())) stop();
  }, [groups, stop]);

  function updateDrag() {
    const active = current.current;
    if (!active) return;
    const before = active.heights.slice(0, active.from).reduce((sum, height) => sum + height, 0);
    const after = active.heights.slice(active.from + 1).reduce((sum, height) => sum + height, 0);
    active.distance = Math.max(-before, Math.min(after, active.dy + offset.current - active.startScroll));
    active.to = dragTarget(active.heights, active.from, active.distance);
    setDrag({ ...active });
  }

  function autoScroll() {
    const active = current.current;
    if (!active) return;
    const { top, height } = viewport.current;
    const edge = Math.min(64, height / 4);
    const above = active.pointerY - top;
    const below = top + height - active.pointerY;
    const speed = above < edge ? -Math.min(12, (edge - above) / 4)
      : below < edge ? Math.min(12, (edge - below) / 4) : 0;
    const next = Math.max(0, Math.min(Math.max(0, contentHeight.current - height), offset.current + speed));
    if (next !== offset.current) {
      offset.current = next;
      scroll.current?.scrollTo({ y: next, animated: false });
      updateDrag();
    }
    animation.current = requestAnimationFrame(autoScroll);
  }

  function begin(group: Group, from: number, pointerY: number) {
    if (group.data.length < 2) return;
    // Wait for real row measurements; cards can have different heights.
    const rowHeights = group.data.map((todo) => heights.current.get(todo.id) ?? 0);
    if (rowHeights.some((height) => height <= 0)) return;
    current.current = {
      group, from, to: from, heights: rowHeights,
      startScroll: offset.current, dy: 0, distance: 0, pointerY,
    };
    viewportRef.current?.measureInWindow((_x, top, _width, height) => {
      viewport.current = { top, height };
    });
    setDrag({ ...current.current });
    animation.current = requestAnimationFrame(autoScroll);
  }

  function finish() {
    const active = current.current;
    stop();
    if (!active || active.from === active.to) return;
    const ordered = moveTask(active.group.data, active.from, active.to);
    onReorder(ordered.map((todo) => todo.id));
    AccessibilityInfo.announceForAccessibility(`${active.group.data[active.from].title} moved to position ${active.to + 1}`);
  }

  return (
    <View ref={viewportRef} style={styles.scroll}>
      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={styles.list}
        scrollEnabled={!drag}
        scrollEventThrottle={16}
        onScroll={(event) => { offset.current = event.nativeEvent.contentOffset.y; }}
        onLayout={(event) => { viewport.current.height = event.nativeEvent.layout.height; }}
        onContentSizeChange={(_width, height) => { contentHeight.current = height; }}
        refreshControl={
          <RefreshControl enabled={!drag} refreshing={loading} onRefresh={() => { if (!current.current) onRefresh(); }} tintColor={colors.accent} />
        }
      >
        {groups.length > 0 ? <Text style={styles.hint}>Drag a handle to reorder within an importance group.</Text> : null}
        {groups.map((group) => (
          <View key={group.priority} style={[styles.section, drag?.group.priority === group.priority && styles.raised]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: group.meta.color }]}>{group.meta.label}</Text>
              <Text style={styles.count}>{group.data.length}</Text>
            </View>
            {group.data.map((todo, index) => {
              const sameGroup = drag?.group.priority === group.priority;
              const active = sameGroup && drag.from === index;
              let translateY = 0;
              if (sameGroup) {
                if (active) translateY = drag.distance;
                else if (index > drag.from && index <= drag.to) translateY = -drag.heights[drag.from];
                else if (index < drag.from && index >= drag.to) translateY = drag.heights[drag.from];
              }
              return (
                <View
                  key={todo.id}
                  onLayout={(event) => heights.current.set(todo.id, event.nativeEvent.layout.height)}
                  style={[{ transform: [{ translateY }] }, active && styles.dragging]}
                >
                  <TodoCard
                    todo={todo}
                    onComplete={drag ? undefined : onComplete}
                    onPress={(item) => { if (!current.current) onPress(item); }}
                    dragHandle={group.data.length > 1 ? (
                      <DragHandle
                        title={todo.title}
                        onBegin={(y) => begin(group, index, y)}
                        onMove={(dy, y) => {
                          if (!current.current) return;
                          current.current.dy = dy;
                          current.current.pointerY = y;
                          updateDrag();
                        }}
                        onFinish={finish}
                        onCancel={stop}
                        onStep={(direction) => {
                          if (drag) return;
                          const reordered = moveTask(group.data, index, index + direction);
                          if (reordered === group.data) return;
                          onReorder(reordered.map((item) => item.id));
                          AccessibilityInfo.announceForAccessibility(`${todo.title} moved to position ${index + direction + 1}`);
                        }}
                      />
                    ) : undefined}
                  />
                </View>
              );
            })}
          </View>
        ))}
        {groups.length === 0 && !loading ? empty : null}
      </ScrollView>
    </View>
  );
}

function DragHandle(props: {
  title: string;
  onBegin: (y: number) => void;
  onMove: (dy: number, y: number) => void;
  onFinish: () => void;
  onCancel: () => void;
  onStep: (direction: number) => void;
}) {
  const latest = useRef(props);
  latest.current = props;
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => true,
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => latest.current.onBegin(event.nativeEvent.pageY),
    onPanResponderMove: (_event, gesture) => latest.current.onMove(gesture.dy, gesture.moveY),
    onPanResponderRelease: () => latest.current.onFinish(),
    onPanResponderTerminate: () => latest.current.onCancel(),
    onPanResponderTerminationRequest: () => false,
  }), []);
  const keyboardProps = Platform.OS === 'web' ? {
    onKeyDown: (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
      if (event.key === 'Escape') {
        latest.current.onCancel();
        return;
      }
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      event.stopPropagation();
      latest.current.onStep(event.key === 'ArrowUp' ? -1 : 1);
    },
  } : {};
  return (
    <View
      {...responder.panHandlers}
      {...keyboardProps}
      style={[styles.handle, Platform.OS === 'web' && { cursor: 'grab', touchAction: 'none' } as any]}
      accessible
      tabIndex={0}
      accessibilityRole="button"
      accessibilityLabel={`Reorder ${props.title}`}
      accessibilityHint="Drag to move within this importance group. Use the move up and move down actions or arrow keys."
      accessibilityActions={[{ name: 'increment', label: 'Move down' }, { name: 'decrement', label: 'Move up' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') props.onStep(1);
        if (event.nativeEvent.actionName === 'decrement') props.onStep(-1);
      }}
    >
      <GripVertical size={20} color={colors.textDim} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, minHeight: 0 },
  list: { paddingHorizontal: 16, paddingBottom: 36, gap: 12 },
  hint: { color: colors.textDim, fontSize: 12, marginBottom: 2 },
  section: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 14 },
  raised: { zIndex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  count: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  dragging: { zIndex: 2, opacity: 0.94, elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8 },
  handle: { width: 32, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
