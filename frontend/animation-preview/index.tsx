import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CelebrationHost } from '../components/completion/Celebration';
import { TodoCard } from '../components/todo/TodoCard';
import { ChristmasArtwork } from '../components/theme/ChristmasArtwork';
import { Snowfall } from '../components/theme/Snowfall';
import { colors } from '../constants/colors';
import type { Todo } from '../services/todos.api';

const tasks: Todo[] = ['Pick up Christmas gifts', 'Send the Christmas cards', 'Make time for a hot chocolate'].map((title, index) => ({
  id: String(index), title, description: ['One thoughtful thing for everyone', 'A little festive hello', 'You’ve earned a cozy moment'][index],
  user_id: 'preview', priority: index ? 'C' : 'B', tags: [], steps: [], deadline: null, planned_at: null,
  is_private: false, status: 'pending', completed_at: null, created_at: '', updated_at: '',
}));

function Preview() {
  const [pending, setPending] = useState(tasks);
  const [generation, setGeneration] = useState(0);
  return <View style={styles.page}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}><View><Text style={styles.title}>My Tasks</Text><Text style={styles.muted}>Christmas completion preview</Text></View><ChristmasArtwork width={125} /></View>
      <Text style={styles.instructions}>Tap a checkbox to wrap a task for Santa.</Text>
      <View style={styles.tabs}><Text style={styles.active}>Today</Text><Text style={styles.muted}>Done · {tasks.length - pending.length}</Text></View>
      <View key={generation}>
        {pending.map(todo => <TodoCard key={todo.id} todo={todo} onPress={() => {}} onComplete={id => setPending(previous => previous.filter(item => item.id !== id))} />)}
      </View>
      <View style={styles.controls}>
        <Text style={styles.muted}>{pending.length ? `${pending.length} tasks left` : 'Everything wrapped up.'}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => { setGeneration(value => value + 1); setPending(tasks); }} style={styles.button}><Text style={styles.buttonText}>Replay</Text></TouchableOpacity>
      </View>
      <Text style={styles.note}>Uses the actual app’s task card and animation components. Sample tasks only.</Text>
    </ScrollView>
    <Snowfall />
    <CelebrationHost key={generation} />
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 35, width: '100%', maxWidth: 520, alignSelf: 'center', paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 27, fontWeight: '800', color: colors.text, marginBottom: 8 },
  muted: { color: colors.textMuted, fontSize: 13 },
  instructions: { color: colors.accent, marginBottom: 20, fontSize: 14 },
  tabs: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between' },
  active: { color: colors.accent, fontWeight: '700' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25 },
  button: { backgroundColor: colors.surfaceAlt, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  buttonText: { color: colors.text, fontWeight: '600' },
  note: { color: colors.textDim, fontSize: 12, lineHeight: 19, marginTop: 22 },
});
registerRootComponent(Preview);
