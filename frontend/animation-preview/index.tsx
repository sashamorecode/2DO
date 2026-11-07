import React, { useMemo, useState } from 'react';
import { registerRootComponent } from 'expo';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { CelebrationHost } from '../components/completion/Celebration';
import { countEnter } from '../components/completion/CompletionLayout';
import { ReorderableTaskBoard } from '../components/todo/ReorderableTaskBoard';
import { ChristmasArtwork } from '../components/theme/ChristmasArtwork';
import { Snowfall } from '../components/theme/Snowfall';
import { colors } from '../constants/colors';
import { PRIORITIES } from '../constants/priorities';
import type { Todo } from '../services/todos.api';

const tasks: Todo[] = ['Pick up Christmas gifts', 'Send the Christmas cards', 'Make time for a hot chocolate', 'Put up the fairy lights'].map((title, index) => ({
  id: String(index), title, description: ['One thoughtful thing for everyone', 'A little festive hello', 'You’ve earned a cozy moment', 'A little sparkle for a winter evening'][index],
  user_id: 'preview', priority: index < 2 ? 'B' : 'C', tags: [], steps: [], deadline: null, planned_at: null,
  is_private: false, status: 'pending', completed_at: null, created_at: '', updated_at: '',
}));

function Preview() {
  const [pending, setPending] = useState(tasks);
  const [generation, setGeneration] = useState(0);
  const groups = useMemo(() => (['B', 'C'] as const).map(priority => ({ priority, meta: PRIORITIES[priority], data: pending.filter(todo => todo.priority === priority) })).filter(group => group.data.length), [pending]);
  return <View style={styles.page}>
    <View style={styles.frame}>
      <View style={styles.top}>
        <View style={styles.header}><View><Text style={styles.title}>My Tasks</Text><Text style={styles.muted}>Christmas completion preview</Text></View><ChristmasArtwork width={110} /></View>
        <Text style={styles.instructions}>Tap a checkbox to wrap a task for Santa.</Text>
        <View style={styles.tabs}><Text style={styles.active}>Today</Text><Animated.Text key={pending.length} entering={countEnter} style={styles.muted}>Done · {tasks.length - pending.length}</Animated.Text></View>
      </View>
      <ReorderableTaskBoard key={generation} groups={groups} loading={false} onRefresh={() => {}}
        onPress={() => {}} onComplete={id => setPending(previous => previous.filter(item => item.id !== id))}
        onReorder={ids => setPending(previous => {
          const ordered = ids.map(id => previous.find(todo => todo.id === id)!);
          let index = 0;
          return previous.map(todo => ids.includes(todo.id) ? ordered[index++] : todo);
        })}
        empty={<View style={styles.empty}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.title}>All wrapped up</Text><Text style={styles.muted}>A little less to do. Enjoy the moment.</Text></View>}
      />
      <View style={styles.footer}>
        <View style={styles.controls}>
          <Animated.Text key={pending.length} entering={countEnter} accessibilityLiveRegion="polite" style={styles.muted}>{pending.length ? `${pending.length} tasks left` : 'Everything wrapped up.'}</Animated.Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => { setGeneration(value => value + 1); setPending(tasks); }} style={styles.button}><Text style={styles.buttonText}>Replay</Text></TouchableOpacity>
        </View>
        <Text style={styles.note}>Actual app task board and animation · sample tasks</Text>
      </View>
    </View>
    <Snowfall />
    <CelebrationHost key={generation} />
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  frame: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  top: { paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: 27, fontWeight: '800', color: colors.text, marginBottom: 8 },
  muted: { color: colors.textMuted, fontSize: 13 },
  instructions: { color: colors.accent, marginBottom: 16, fontSize: 14 },
  tabs: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' },
  active: { color: colors.accent, fontWeight: '700' },
  footer: { padding: 16, borderTopWidth: 1, borderColor: colors.border },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: { backgroundColor: colors.surfaceAlt, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  buttonText: { color: colors.text, fontWeight: '600' },
  note: { color: colors.textDim, fontSize: 11, lineHeight: 18, marginTop: 12 },
  empty: { paddingVertical: 35, alignItems: 'center', gap: 8 },
  emptyIcon: { color: colors.accent, fontSize: 48 },
});
registerRootComponent(Preview);
