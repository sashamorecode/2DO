import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Users } from 'lucide-react-native';
import { colors } from '../../constants/colors';

interface Props {
  requesterName: string;
  taskTitle?: string;
  scheduledAt: string;
  status: string;
  inviteeCount: number;
  acceptedCount: number;
}

export function SessionCard({
  requesterName,
  taskTitle,
  scheduledAt,
  status,
  inviteeCount,
  acceptedCount,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Users size={16} color={colors.accentLight} strokeWidth={2.2} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {taskTitle ?? 'Body Double Session'}
        </Text>
        <Text style={styles.subtitle}>
          with {requesterName} · {scheduledAt}
        </Text>
        <View style={styles.statusRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{status}</Text>
          </View>
          {inviteeCount > 0 && (
            <Text style={styles.counts}>
              {acceptedCount}/{inviteeCount} joined
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent + '22',
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  badge: {
    backgroundColor: colors.accent + '22',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: colors.accentLight, fontSize: 11, fontWeight: '700' },
  counts: { color: colors.textDim, fontSize: 11 },
});
