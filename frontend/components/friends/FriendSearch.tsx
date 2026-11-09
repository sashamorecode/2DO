import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../constants/colors';
import { friendsApi } from '../../services/friends.api';
import { Input } from '../ui/Input';

interface Props {
  onSendRequest: (userId: string) => Promise<unknown>;
  disabled?: boolean;
}

export function FriendSearch({ onSendRequest, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; username: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const pendingRef = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    setResults([]);
    setError('');
    if (disabled || query.trim().length < 2) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await friendsApi.searchUsers(query.trim());
        if (active) setResults(data);
      } catch {
        if (active) setError("Couldn't search. Edit your search to try again.");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, disabled]);

  async function handleSend(id: string) {
    if (disabled || pendingRef.current.has(id) || sent.has(id)) return;
    pendingRef.current.add(id);
    setPending(new Set(pendingRef.current));
    try {
      await onSendRequest(id);
      setSent((current) => new Set(current).add(id));
    } catch {
      // The parent presents the error. Keep Add available for retry.
    } finally {
      pendingRef.current.delete(id);
      setPending(new Set(pendingRef.current));
    }
  }

  return (
    <View>
      <Input
        label="Find a friend"
        placeholder="Search by username…"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!disabled}
        value={query}
        onChangeText={setQuery}
        error={error}
      />
      {loading ? <ActivityIndicator accessibilityLabel="Searching for friends" color={colors.accent} /> : null}
      {!disabled && !loading && !error && query.trim().length >= 2 && results.length === 0 ? (
        <Text style={styles.hint}>No matching usernames. Try another name.</Text>
      ) : null}
      {results.map((u) => {
        const busy = pending.has(u.id);
        const isSent = sent.has(u.id);
        return (
          <View key={u.id} style={styles.result}>
            <Text style={styles.username}>{u.username}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={isSent ? `Request sent to ${u.username}` : `Add ${u.username}`}
              accessibilityState={{ disabled: !!disabled || busy || isSent, busy }}
              style={[styles.addBtn, isSent && styles.sentBtn]}
              onPress={() => { void handleSend(u.id); }}
              disabled={disabled || busy || isSent}
            >
              {busy ? <ActivityIndicator color={colors.onAccent} /> : (
                <Text style={[styles.addText, isSent && { color: colors.textMuted }]}>{isSent ? 'Sent' : '+ Add'}</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  result: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  username: { flex: 1, color: colors.text, fontSize: 15 },
  hint: { color: colors.textMuted, fontSize: 14 },
  addBtn: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  sentBtn: { backgroundColor: colors.surfaceAlt },
  addText: { color: colors.onAccent, fontWeight: '700', fontSize: 13 },
});
