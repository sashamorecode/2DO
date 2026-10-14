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
    <View
      style={[
        styles.chip,
        soonIn6h && { backgroundColor: `${colors.warning}26`, borderColor: `${colors.warning}55` },
        overdue && { backgroundColor: `${colors.error}2E`, borderColor: `${colors.error}80` },
      ]}
    >
      <Icon size={12} color={color} strokeWidth={2.8} />
      <Text style={[styles.text, { color }, overdue && styles.textOverdue]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  text: { fontSize: 12, fontWeight: '700' },
  textOverdue: { fontWeight: '800', letterSpacing: 0.2 },
});
