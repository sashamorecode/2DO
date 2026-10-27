import { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { ViewportCobwebs } from '../theme/HalloweenArtwork';

// Own keyboard avoidance once, above navigation, so every screen and its
// controls lay out inside the visible area. Scroll views only reveal focus.
export function AppViewport({ children }: PropsWithChildren) {
  return (
    <KeyboardAvoidingView behavior="height" style={styles.viewport}>
      {children}
      <ViewportCobwebs />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, minHeight: 0, overflow: 'hidden' },
});
