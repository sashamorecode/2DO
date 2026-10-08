import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';

interface Props extends ViewProps {
  children: React.ReactNode;
  // Only horizontal edges: (app) screens sit below a navigator header that
  // already consumes the top inset, and above the tab bar which already
  // consumes the bottom inset. Adding either here would double-pad it.
  edges?: readonly Edge[];
}

export function Screen({ children, style, edges = ['left', 'right'], ...rest }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[styles.container, style]} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
});
