import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';

interface Props extends ViewProps {
  children: React.ReactNode;
  // Defaults to bottom/left/right because (app) screens sit under a navigator
  // header that already consumes the top inset; including 'top' here would
  // double-pad it.
  edges?: readonly Edge[];
}

export function Screen({ children, style, edges = ['left', 'right', 'bottom'], ...rest }: Props) {
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
