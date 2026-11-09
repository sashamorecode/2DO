import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../constants/colors';
import { Avatar } from '../ui/Avatar';

interface Props {
  username: string;
  onRemove?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function FriendCard({ username, onRemove, disabled, loading }: Props) {
  return (
    <View style={styles.card}>
      <Avatar username={username} />
      <Text style={styles.name}>{username}</Text>
      {onRemove && (
        <TouchableOpacity disabled={disabled || loading} accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }} accessibilityRole="button" accessibilityLabel={`Remove ${username} from friends`} onPress={onRemove} style={styles.removeBtn}>
          {loading ? <ActivityIndicator color={colors.error} /> : <Text style={styles.removeText}>Remove</Text>}
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
  removeBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 4 },
  removeText: { color: colors.error, fontSize: 14 },
});
