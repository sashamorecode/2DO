import { useCallback } from 'react';
import { findNodeHandle, ScrollViewProps, View } from 'react-native';
import { useFocusedInputHandler, useReanimatedFocusedInput } from 'react-native-keyboard-controller';
import Animated, {
  measure,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useScrollViewOffset,
  useSharedValue,
} from 'react-native-reanimated';
import { focusScrollDelta } from '../../services/viewport';

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  bottomOffset?: number;
}

// AppViewport removes the keyboard's area. Measure the scroll view's actual
// bounds, including headers and controls, instead of adding that area again.
export function KeyboardAwareScrollView({
  bottomOffset = 24,
  keyboardShouldPersistTaps = 'handled',
  onLayout,
  onContentSizeChange,
  style,
  children,
  ...rest
}: KeyboardAwareScrollViewProps) {
  const ref = useAnimatedRef<Animated.ScrollView>();
  const offset = useScrollViewOffset(ref);
  const target = useSharedValue<number | null>(null);
  const layoutVersion = useSharedValue(0);
  const caret = useSharedValue<{ target: number; y: number } | null>(null);
  const { input } = useReanimatedFocusedInput();

  const revealFocus = useCallback(() => {
    'worklet';
    const focused = input.value;
    if (!focused || focused.parentScrollViewTarget !== target.value) return;
    const viewport = measure(ref);
    if (!viewport) return;
    const tallInput = focused.layout.height > viewport.height - bottomOffset * 2;
    const caretY = caret.value?.target === focused.target ? caret.value.y : 24;
    const inputTop = focused.layout.absoluteY + (tallInput ? Math.max(0, caretY - 24) : 0);
    const inputHeight = tallInput ? 24 : focused.layout.height;
    const delta = focusScrollDelta(
      viewport.pageY, viewport.height, inputTop, inputHeight, bottomOffset,
    );
    if (Math.abs(delta) > 1) scrollTo(ref, 0, Math.max(0, offset.value + delta), false);
  }, [bottomOffset]);

  useAnimatedReaction(
    () => ({ input: input.value, layout: layoutVersion.value, caret: caret.value }),
    () => revealFocus(),
    [revealFocus],
  );
  useFocusedInputHandler({
    onSelectionChange: (event) => {
      'worklet';
      caret.value = { target: event.target, y: event.selection.end.y };
    },
  }, []);

  return (
    <Animated.ScrollView
      {...rest}
      ref={ref}
      style={[{ flex: 1, minHeight: 0 }, style]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      automaticallyAdjustKeyboardInsets={false}
      scrollEventThrottle={16}
      onLayout={(event) => {
        target.value = findNodeHandle(ref.current);
        layoutVersion.value += 1;
        onLayout?.(event);
      }}
      onContentSizeChange={(width, height) => {
        layoutVersion.value += 1;
        onContentSizeChange?.(width, height);
      }}
    >
      {children}
      <View style={{ height: bottomOffset }} />
    </Animated.ScrollView>
  );
}
