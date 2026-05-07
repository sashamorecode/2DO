import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';

interface Props {
  username: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function FriendRequestCard({ username, onAccept, onDecline }: Props) {
  const initials = username.slice(0, 2).toUpperCase();
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <Text style={styles.name}>{username}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={onAccept}>
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.declineBtn]} onPress={onDecline}>
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.accent + '55',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent + '33',
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  name: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  acceptBtn: { backgroundColor: colors.success + '22', borderWidth: 1, borderColor: colors.success },
  declineBtn: { backgroundColor: colors.error + '22', borderWidth: 1, borderColor: colors.error },
  acceptText: { color: colors.success, fontWeight: '700', fontSize: 13 },
  declineText: { color: colors.error, fontWeight: '700', fontSize: 13 },
});
