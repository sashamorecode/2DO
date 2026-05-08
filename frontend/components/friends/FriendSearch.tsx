import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../constants/colors';
import { friendsApi } from '../../services/friends.api';
import { Input } from '../ui/Input';

interface Props {
  onSendRequest: (userId: string) => void;
}

export function FriendSearch({ onSendRequest }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; username: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());

  async function search(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await friendsApi.searchUsers(q);
      setResults(data);
    } finally {
      setLoading(false);
    }
  }

  function handleSend(id: string) {
    onSendRequest(id);
    setSent((s) => new Set(s).add(id));
  }

  return (
    <View>
      <Input
        placeholder="Search by username..."
        value={query}
        onChangeText={search}
      />
      {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} />}
      {results.map((u) => (
        <View key={u.id} style={styles.result}>
          <Text style={styles.username}>{u.username}</Text>
          <TouchableOpacity
            style={[styles.addBtn, sent.has(u.id) && styles.sentBtn]}
            onPress={() => handleSend(u.id)}
            disabled={sent.has(u.id)}
          >
            <Text style={styles.addText}>{sent.has(u.id) ? 'Sent' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  username: { flex: 1, color: colors.text, fontSize: 15 },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sentBtn: { backgroundColor: colors.surfaceAlt },
  addText: { color: '#FFF5FB', fontWeight: '700', fontSize: 13 },
});
