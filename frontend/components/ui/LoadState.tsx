import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { Button } from './Button';

export function LoadState({ title, description, loading, onRetry }: {
  title: string;
  description?: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.panel}>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      <Text accessibilityLiveRegion="polite" style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { margin: 16, padding: 20, gap: 12, borderRadius: 14, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
});
