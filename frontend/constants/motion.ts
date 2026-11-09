import { Easing as RNEasing } from 'react-native';
import { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

// One curve vocabulary for the whole app. Reduced-motion variants stay gentle
// (short fades, no travel) rather than switching motion off entirely, so state
// changes remain legible. Pick the variant per call site with useReducedMotion().
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);
// React Navigation transitions run on RN Animated, which needs RN's own Easing.
export const navEaseOut = RNEasing.bezier(0.23, 1, 0.32, 1);

export const gentleDuration = 120;

export const rowEnter = FadeInDown.duration(200).easing(easeOut).withInitialValues({ transform: [{ translateY: 6 }] });
export const listLayout = LinearTransition.duration(240).easing(easeOut);
export const disclosureEnter = FadeIn.duration(180).easing(easeOut);
export const disclosureExit = FadeOut.duration(120).easing(easeInOut);

export const gentleEnter = FadeIn.duration(gentleDuration);
export const gentleExit = FadeOut.duration(gentleDuration);
export const gentleLayout = LinearTransition.duration(gentleDuration);
