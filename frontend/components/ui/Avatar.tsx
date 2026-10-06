import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';

interface Props {
  username: string;
  size?: number;
  textColor?: string;
}

export function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

export function Avatar({ username, size = 40, textColor = colors.accent }: Props) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.text, { color: textColor, fontSize: Math.round(size * 0.35) }]}>
        {getInitials(username)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.accent + '33',
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontWeight: '700' },
});
