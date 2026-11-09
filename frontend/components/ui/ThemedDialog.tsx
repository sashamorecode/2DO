import { useEffect, type ReactNode } from 'react';
import { Modal, View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import Animated, { cancelAnimation, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors } from '../../constants/colors';
import { easeInOut, easeOut } from '../../constants/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { DialogAction } from '../../services/appDialog';

export function ThemedDialog({ title, children, actions, onClose, exiting, onExited }: {
  title: string;
  children: ReactNode;
  actions: Array<DialogAction & { disabled?: boolean }>;
  onClose: () => void;
  exiting: boolean;
  onExited: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.96);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: reducedMotion ? [] : [{ scale: scale.value }],
  }));

  useEffect(() => {
    const config = {
      duration: exiting ? 180 : 200,
      easing: exiting ? easeInOut : easeOut,
      // The hook removes scale; system reduction must not skip the remaining fade.
      reduceMotion: ReduceMotion.Never,
    };
    opacity.value = withTiming(exiting ? 0 : 1, config, (finished) => {
      if (finished && exiting) runOnJS(onExited)();
    });
    scale.value = withTiming(exiting ? 0.98 : 1, config);
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [exiting, onExited, opacity, scale]);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents={exiting ? 'none' : 'auto'}
        accessibilityElementsHidden={exiting}
        importantForAccessibility={exiting ? 'no-hide-descendants' : 'auto'}
      >
        <Animated.View style={[styles.backdrop, overlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} focusable={false} />
        </Animated.View>
        <Animated.View style={[styles.card, cardStyle]} accessibilityLabel={title} role="dialog" accessibilityViewIsModal onAccessibilityEscape={onClose}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            {children}
          </ScrollView>
          {actions.length > 0 && <DialogActions actions={actions.map((action) => ({ ...action, disabled: exiting || action.disabled }))} />}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function DialogActions({ actions }: { actions: Array<DialogAction & { disabled?: boolean }> }) {
  return (
    <View style={styles.actions}>
      {actions.map((action, index) => (
        <Pressable
          key={index}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!action.disabled }}
          disabled={action.disabled}
          onPress={action.onPress}
          style={({ pressed }) => [styles.button,
            action.style !== 'cancel' && styles.primary,
            action.style === 'destructive' && styles.destructive,
            (pressed || action.disabled) && { opacity: 0.5 }]}
        >
          <Text style={[styles.buttonText, action.style !== 'cancel' && { color: colors.onAccent }]}>{action.text}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000099' },
  card: { width: '100%', maxWidth: 420, maxHeight: '90%', borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  content: { padding: 20, gap: 16 },
  title: { color: colors.text, fontSize: 21, fontWeight: '800' },
  actions: { padding: 16, paddingTop: 0, gap: 8 },
  button: { minHeight: 46, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surfaceAlt },
  primary: { backgroundColor: colors.accent },
  destructive: { backgroundColor: colors.error },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
