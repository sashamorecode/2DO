import {
  KeyboardAwareScrollView as NativeKeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

type Props = KeyboardAwareScrollViewProps;

// Shared keyboard-aware scroll container. Keeps the focused input (and the
// rest of the form) above the on-screen keyboard on iOS and Android. The
// keyboard-controller fallbacks make this a plain ScrollView on web.
export function KeyboardAwareScrollView({
  bottomOffset = 24,
  keyboardShouldPersistTaps = 'handled',
  ...rest
}: Props) {
  return (
    <NativeKeyboardAwareScrollView
      bottomOffset={bottomOffset}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...rest}
    />
  );
}
