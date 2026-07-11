import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';

interface Props {
  username: string;
  taskTitle?: string;
  message?: string;
  scheduledAt: string;
  loading?: boolean;
  onAccept: () => void;
  onMaybe: () => void;
  onDecline: () => void;
}

export function BodyDoubleInvitationCard({
  username,
  taskTitle,
  message,
  scheduledAt,
  loading,
  onAccept,
  onMaybe,
  onDecline,
}: Props) {
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{username}</Text>
          {taskTitle && <Text style={styles.taskTitle}>{taskTitle}</Text>}
          <Text style={styles.date}>{scheduledAt}</Text>
        </View>
      </View>

      {message ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.acceptBtn]}
          onPress={onAccept}
          disabled={loading}
        >
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.maybeBtn]}
          onPress={onMaybe}
          disabled={loading}
        >
          <Text style={styles.maybeText}>Maybe</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.declineBtn]}
          onPress={onDecline}
          disabled={loading}
        >
          <Text style={styles.declineText}>Can't Come</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.accent + '55',
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent + '33',
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  info: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  taskTitle: { color: colors.textMuted, fontSize: 13 },
  date: { color: colors.accentLight, fontSize: 12, fontWeight: '600' },
  messageBox: {
    backgroundColor: colors.bg + '66',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentMuted,
  },
  messageText: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: colors.success + '22',
    borderWidth: 1,
    borderColor: colors.success,
  },
  maybeBtn: {
    backgroundColor: colors.warning + '22',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  declineBtn: {
    backgroundColor: colors.error + '22',
    borderWidth: 1,
    borderColor: colors.error,
  },
  acceptText: { color: colors.success, fontWeight: '700', fontSize: 13 },
  maybeText: { color: colors.warning, fontWeight: '700', fontSize: 13 },
  declineText: { color: colors.error, fontWeight: '700', fontSize: 13 },
});
