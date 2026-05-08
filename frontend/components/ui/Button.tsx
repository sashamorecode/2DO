import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

const variants = {
  primary: {
    bg: colors.accent,
    border: colors.accentDark,
    text: '#FFF5FB',
  },
  secondary: {
    bg: colors.surfaceAlt,
    border: colors.border,
    text: colors.accentLight,
  },
  danger: {
    bg: colors.error + '22',
    border: colors.error,
    text: colors.error,
  },
} as const;

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const v = variants[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled || loading ? 0.55 : 1,
        },
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={[styles.label, { color: v.text }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  label: { fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },
});
