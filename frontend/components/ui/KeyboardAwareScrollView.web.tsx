import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import type { KeyboardAwareScrollViewProps } from './KeyboardAwareScrollView';
import { focusScrollDelta } from '../../services/viewport';

export function KeyboardAwareScrollView({
  bottomOffset = 24,
  keyboardShouldPersistTaps = 'handled',
  onLayout,
  onContentSizeChange,
  style,
  children,
  ...rest
}: KeyboardAwareScrollViewProps) {
  const ref = useRef<ScrollView>(null);
  const frame = useRef<number | undefined>(undefined);
  const revealFocus = useCallback(() => {
    cancelAnimationFrame(frame.current ?? 0);
    frame.current = requestAnimationFrame(() => {
      const scroll = ref.current?.getScrollableNode() as HTMLElement | undefined;
      const input = document.activeElement;
      if (!scroll || !(input instanceof HTMLElement) || !scroll.contains(input)) return;
      const bounds = scroll.getBoundingClientRect();
      const focused = input.getBoundingClientRect();
      scroll.scrollTop += focusScrollDelta(bounds.top, bounds.height, focused.top, focused.height, bottomOffset);
    });
  }, [bottomOffset]);

  useEffect(() => {
    document.addEventListener('focusin', revealFocus);
    window.visualViewport?.addEventListener('resize', revealFocus);
    return () => {
      document.removeEventListener('focusin', revealFocus);
      window.visualViewport?.removeEventListener('resize', revealFocus);
      cancelAnimationFrame(frame.current ?? 0);
    };
  }, [revealFocus]);

  return (
    <ScrollView
      {...rest}
      ref={ref}
      style={[{ flex: 1, minHeight: 0 }, style]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      onLayout={(event) => { revealFocus(); onLayout?.(event); }}
      onContentSizeChange={(width, height) => { revealFocus(); onContentSizeChange?.(width, height); }}
    >
      {children}
      <View style={{ height: bottomOffset }} />
    </ScrollView>
  );
}
