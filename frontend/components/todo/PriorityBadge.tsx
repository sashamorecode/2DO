import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Priority, PRIORITIES } from '../../constants/priorities';

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, color, description } = PRIORITIES[priority];
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
      <Text style={[styles.desc, { color }]}>{description}</Text>
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
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: { fontWeight: '800', fontSize: 12 },
  desc: { fontSize: 11, fontWeight: '500' },
});
