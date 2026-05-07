import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { formatDistanceToNow, isPast, isWithinInterval, addHours } from 'date-fns';
import { colors } from '../../constants/colors';

export function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null;

  const date = new Date(deadline);
  const overdue = isPast(date);
  const soonIn6h = !overdue && isWithinInterval(date, { start: new Date(), end: addHours(new Date(), 6) });

  const color = overdue ? colors.error : soonIn6h ? colors.warning : colors.textMuted;
  const prefix = overdue ? 'Overdue ' : 'Due ';
  const label = prefix + formatDistanceToNow(date, { addSuffix: true });

  return <Text style={[styles.text, { color }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 12, fontWeight: '600' },
});
