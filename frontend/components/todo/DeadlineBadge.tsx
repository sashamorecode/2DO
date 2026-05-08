import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, AlertTriangle } from 'lucide-react-native';
import { formatDistanceToNow, isPast, isWithinInterval, addHours } from 'date-fns';
import { colors } from '../../constants/colors';

export function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null;

  const date = new Date(deadline);
  const overdue = isPast(date);
  const soonIn6h =
    !overdue && isWithinInterval(date, { start: new Date(), end: addHours(new Date(), 6) });

  const color = overdue ? colors.error : soonIn6h ? colors.warning : colors.textMuted;
  const Icon = overdue ? AlertTriangle : Clock;
  const prefix = overdue ? 'Overdue ' : 'Due ';
  const label = prefix + formatDistanceToNow(date, { addSuffix: true });

  return (
    <View style={styles.row}>
      <Icon size={11} color={color} strokeWidth={2.4} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { fontSize: 12, fontWeight: '600' },
});
