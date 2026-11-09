import React from 'react';
import { TextInput, Text, View, StyleSheet, TextInputProps } from 'react-native';
import { colors } from '../../constants/colors';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<TextInput, Props>(function Input({ label, error, style, ...rest }, ref) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error}
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.textMuted}
        {...rest}
      />
      {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontSize: 12, marginTop: 4, fontWeight: '600' },
});
