import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { calendarDays, applyTime } from '../../services/datePicker';
import { DialogActions } from './ThemedDialog';

export function DateTimeDialog({ mode, value, onSave, onClose }: {
  mode: 'date' | 'time'; value: Date; onSave: (value: Date) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState(value);
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1, 12));
  const [hours, setHours] = useState(String(value.getHours()).padStart(2, '0'));
  const [minutes, setMinutes] = useState(String(value.getMinutes()).padStart(2, '0'));
  const time = applyTime(value, hours, minutes);
  return (
    <>
      {mode === 'date' ? <View>
        <View style={styles.monthRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" style={styles.arrow} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}>
            <ChevronLeft color={colors.accentLight} size={22} />
          </Pressable>
          <Text style={styles.month} accessibilityLiveRegion="polite">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" style={styles.arrow} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}>
            <ChevronRight color={colors.accentLight} size={22} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {Array.from({ length: 7 }, (_, day) => <Text key={`weekday-${day}`} style={styles.weekday}>
            {new Date(2026, 10, 1 + day).toLocaleDateString(undefined, { weekday: 'narrow' })}
          </Text>)}
          {calendarDays(month.getFullYear(), month.getMonth()).map((date, index) => {
            const picked = date?.toDateString() === selected.toDateString();
            return <View key={index} style={styles.dayCell}>
              {date && <Pressable
                accessibilityRole="button"
                accessibilityLabel={date.toLocaleDateString(undefined, { dateStyle: 'full' })}
                accessibilityState={{ selected: picked }}
                style={[styles.day, picked && styles.selected]}
                onPress={() => { const next = new Date(date); next.setHours(value.getHours(), value.getMinutes(), 0, 0); setSelected(next); }}
              ><Text style={[styles.dayText, picked && { color: colors.onAccent }]}>{date.getDate()}</Text></Pressable>}
            </View>;
          })}
        </View>
        <Text style={styles.hint}>Selected: {selected.toLocaleDateString(undefined, { dateStyle: 'medium' })}</Text>
      </View> : <View style={{ gap: 12 }}>
        <Text style={styles.hint}>24-hour time</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeField}><Text style={styles.hint}>Hour</Text><TextInput
            accessibilityLabel="Hour, 0 to 23" keyboardType="number-pad" maxLength={2}
            value={hours} onChangeText={setHours} selectTextOnFocus style={styles.input}
          /></View>
          <Text style={styles.dayText}>:</Text>
          <View style={styles.timeField}><Text style={styles.hint}>Minute</Text><TextInput
            accessibilityLabel="Minute, 0 to 59" keyboardType="number-pad" maxLength={2}
            value={minutes} onChangeText={setMinutes} selectTextOnFocus style={styles.input}
          /></View>
        </View>
        {!time && <Text style={{ color: colors.error }} accessibilityLiveRegion="polite">Use hours 0–23 and minutes 0–59.</Text>}
      </View>}
      <DialogActions actions={[
        { text: 'Save', disabled: mode === 'time' && !time, onPress: () => { onSave(mode === 'date' ? selected : time!); } },
        { text: 'Cancel', style: 'cancel', onPress: onClose },
      ]} />
    </>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  month: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.285714%', textAlign: 'center', color: colors.textMuted, paddingVertical: 8 },
  dayCell: { width: '14.285714%', minHeight: 44, padding: 1 },
  day: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: colors.accent },
  dayText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeField: { flex: 1, gap: 6 },
  input: { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 12, color: colors.text, fontSize: 28, padding: 14, textAlign: 'center' },
});
