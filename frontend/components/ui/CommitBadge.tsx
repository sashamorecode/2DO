import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../../constants/colors';
import { COMMIT_HASH } from '../../constants/build';

export function CommitBadge() {
  return (
    <Text style={styles.text} numberOfLines={1}>
      {COMMIT_HASH}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: colors.textDim,
    fontVariant: ['tabular-nums'],
    marginRight: 12,
  },
});
