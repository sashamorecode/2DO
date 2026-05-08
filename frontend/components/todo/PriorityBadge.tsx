import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Flame, Star, Leaf } from 'lucide-react-native';
import { Priority, PRIORITIES } from '../../constants/priorities';

const ICONS: Record<Priority, typeof Flame> = {
  A: Flame,
  B: Star,
  C: Leaf,
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, color } = PRIORITIES[priority];
  const Icon = ICONS[priority];
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Icon size={11} color={color} strokeWidth={2.6} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: { fontWeight: '800', fontSize: 12 },
  desc: { fontSize: 11, fontWeight: '500' },
});
