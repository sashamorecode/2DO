import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { Avatar } from '../ui/Avatar';

interface Props {
  username: string;
  onRemove?: () => void;
}

export function FriendCard({ username, onRemove }: Props) {
  return (
    <View style={styles.card}>
      <Avatar username={username} />
      <Text style={styles.name}>{username}</Text>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      )}
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
    borderColor: colors.border,
    gap: 12,
  },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  removeText: { color: colors.error, fontSize: 14 },
});
