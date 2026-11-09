import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import Animated, {
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { completionLayout, completionExit, completionEnter, countEnter } from '../completion/CompletionLayout';
import { GripVertical } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { easeOut, gentleDuration, gentleEnter, gentleLayout, listLayout, rowEnter } from '../../constants/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { Todo } from '../../services/todos.api';
import { dragTarget, moveTask } from '../../services/todoOrder';
import { TodoCard } from './TodoCard';

// Drag-only timings: siblings make room quickly, the dropped row lands a little slower.
const liftDuration = 120;
const shiftDuration = 180;
const dropDuration = 260;

type Group = { priority: string; meta: { label: string; color: string }; data: Todo[] };

// A released row and the reorder it implies, shown locally until the parent's
// data catches up so the list never flashes back to the old order.
type Drop = { priority: string; id: string; before: string; from: number; to: number; offset: number };

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
  const completing = useRef(new Set<string>());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const reduced = useReducedMotion();
  const present = useMemo(() => new Set(groups.flatMap((group) => group.data.map((todo) => todo.id))), [groups]);
  // Only a completion holds the reflow while its paper closes; inserts and
  // reorders should make room straight away.
  const reflow = [...completing.current].some((id) => !present.has(id)) ? completionLayout
    : reduced ? gentleLayout : listLayout;

  const stop = useCallback(() => {
    cancelAnimationFrame(animation.current ?? 0);
    current.current = null;
    setDrag(null);
  }, []);
  useEffect(() => () => cancelAnimationFrame(animation.current ?? 0), []);
  useEffect(() => {
    for (const id of completing.current) if (!present.has(id)) completing.current.delete(id);
    const active = current.current;
    if (active && !groups.some((group) => group.priority === active.group.priority &&
      group.data.map((todo) => todo.id).join() === active.group.data.map((todo) => todo.id).join())) stop();
  }, [groups, present, stop]);
  useEffect(() => {
    if (!drop) return;
    // Outlast the landing so the row stays raised above the siblings it crosses.
    const timer = setTimeout(() => setDrop(null), dropDuration + 40);
    return () => clearTimeout(timer);
  }, [drop]);

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
    if (!active) return;
    stop();
    const { group, from, to, distance } = active;
    // Restate the finger offset relative to the new slot, so the row keeps its
    // on-screen position when the list reorders beneath it and travels from there.
    const crossed = to > from ? active.heights.slice(from + 1, to + 1) : active.heights.slice(to, from);
    const landing = Math.sign(to - from) * crossed.reduce((sum, height) => sum + height, 0);
    setDrop({
      priority: group.priority, id: group.data[from].id, before: group.data.map((todo) => todo.id).join(),
      from, to, offset: distance - landing,
    });
    if (from === to) return;
    onReorder(moveTask(group.data, from, to).map((todo) => todo.id));
    AccessibilityInfo.announceForAccessibility(`${group.data[from].title} moved to position ${to + 1}`);
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
        <LayoutAnimationConfig skipEntering>
          {groups.map((source, groupIndex) => {
            const group = drop?.priority === source.priority && source.data.map((todo) => todo.id).join() === drop.before
              ? { ...source, data: moveTask(source.data, drop.from, drop.to) } : source;
            return (
              <Fragment key={group.priority}>
                <Animated.View testID={`task-group-${group.priority}`} layout={reflow} exiting={completionExit} style={[styles.header, { marginTop: groupIndex === 0 ? 4 : 16 }]}>
                  <Text style={[styles.title, { color: group.meta.color }]}>{group.meta.label}</Text>
                  <Animated.Text key={group.data.length} entering={countEnter} style={styles.count}>{group.data.length}</Animated.Text>
                </Animated.View>
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
                    <TaskRow
                      key={todo.id}
                      id={todo.id}
                      index={index}
                      offset={translateY}
                      dragging={active}
                      landing={drop?.id === todo.id ? drop : undefined}
                      reduced={reduced}
                      layout={drag || drop ? undefined : reflow}
                      onMeasure={(height) => heights.current.set(todo.id, height)}
                    >
                      <TodoCard
                        todo={todo}
                        onComplete={drag ? undefined : (id) => {
                          completing.current.add(id);
                          onComplete(id);
                        }}
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
                            onCancel={() => {
                              // A cancelled drag lands back where it started.
                              if (current.current) current.current.to = current.current.from;
                              finish();
                            }}
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
                    </TaskRow>
                  );
                })}
              </Fragment>
            );
          })}
          {groups.length === 0 && !loading ? <Animated.View entering={completionEnter}>{empty}</Animated.View> : null}
        </LayoutAnimationConfig>
      </ScrollView>
    </View>
  );
}

function TaskRow({ id, index, offset, dragging, landing, reduced, layout, onMeasure, children }: {
  id: string;
  index: number;
  offset: number;
  dragging: boolean;
  landing?: Drop;
  reduced: boolean;
  layout?: typeof listLayout;
  onMeasure: (height: number) => void;
  children: React.ReactNode;
}) {
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const lastIndex = useRef(index);
  const motion = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }, { scale: scale.value }],
  }));

  // Layout effects send offsets with the commit that moves the row, keeping
  // transform and slot change in the same frame where possible.
  useLayoutEffect(() => {
    // A row that changed slots was moved by the commit itself, so its offset is
    // already accounted for; animating it as well would show it twice.
    if (dragging || lastIndex.current !== index) y.value = offset;
    else y.value = withTiming(offset, { duration: reduced ? gentleDuration : shiftDuration, easing: easeOut });
    lastIndex.current = index;
  }, [dragging, index, offset, reduced, y]);
  useLayoutEffect(() => {
    if (!landing || reduced) return;
    y.value = withSequence(
      withTiming(landing.offset, { duration: 0 }),
      withTiming(0, { duration: dropDuration, easing: easeOut }),
    );
  }, [landing, reduced, y]);
  useEffect(() => {
    const timing = { duration: dragging ? liftDuration : reduced ? gentleDuration : dropDuration, easing: easeOut };
    scale.value = withTiming(dragging && !reduced ? 1.02 : 1, timing);
    // With reduced motion this dim on lift and recovery on drop is the only cue.
    opacity.value = withTiming(dragging ? 0.94 : 1, timing);
  }, [dragging, reduced, scale, opacity]);

  const lifted = dragging || landing !== undefined;
  return (
    <Animated.View
      layout={layout}
      entering={reduced ? gentleEnter : rowEnter}
      exiting={completionExit}
      testID={`task-row-${id}`}
      onLayout={(event) => onMeasure(event.nativeEvent.layout.height)}
      style={lifted && styles.raised}
    >
      {/* Drag motion lives on an inner view so it never fights the entering transform. */}
      <Animated.View style={[motion, lifted && styles.dragging]}>{children}</Animated.View>
    </Animated.View>
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
  list: { paddingHorizontal: 16, paddingBottom: 36 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  count: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  raised: { zIndex: 2 },
  dragging: { elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8 },
  handle: { width: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
