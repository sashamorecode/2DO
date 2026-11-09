import { AppDialog } from '../../services/appDialog';
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../constants/colors';
import { Avatar } from '../ui/Avatar';

interface Props {
  username: string;
  onAccept: () => Promise<unknown>;
  onDecline: () => Promise<unknown>;
  disabled?: boolean;
}

export function FriendRequestCard({ username, onAccept, onDecline, disabled }: Props) {
  const pending = useRef(false);
  const [action, setAction] = useState<'accept' | 'decline' | null>(null);
  const unavailable = !!disabled || action !== null;
  async function respond(next: 'accept' | 'decline') {
    if (disabled || pending.current) return;
    pending.current = true;
    setAction(next);
    try {
      await (next === 'accept' ? onAccept() : onDecline());
    } catch {
      AppDialog.alert("Couldn't respond to this request", 'Please try again when connected.');
    } finally {
      pending.current = false;
      setAction(null);
    }
  }
  return (
    <View style={styles.card}>
      <View style={styles.identity}>
        <Avatar username={username} size={36} />
        <Text style={styles.name}>{username}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Accept request from ${username}`} style={[styles.btn, styles.acceptBtn]} disabled={unavailable} accessibilityState={{ disabled: unavailable, busy: action === 'accept' }} onPress={() => { void respond('accept'); }}>
          {action === 'accept' ? <ActivityIndicator color={colors.success} /> : <Text style={styles.acceptText}>Accept</Text>}
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Decline request from ${username}`} style={[styles.btn, styles.declineBtn]} disabled={unavailable} accessibilityState={{ disabled: unavailable, busy: action === 'decline' }} onPress={() => { void respond('decline'); }}>
          {action === 'decline' ? <ActivityIndicator color={colors.error} /> : <Text style={styles.declineText}>Decline</Text>}
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
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.accent + '55',
    gap: 10,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { flexGrow: 1, minWidth: 100, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  acceptBtn: { backgroundColor: colors.success + '22', borderWidth: 1, borderColor: colors.success },
  declineBtn: { backgroundColor: colors.error + '22', borderWidth: 1, borderColor: colors.error },
  acceptText: { color: colors.success, fontWeight: '700', fontSize: 13 },
  declineText: { color: colors.error, fontWeight: '700', fontSize: 13 },
});
