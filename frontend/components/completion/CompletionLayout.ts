import { Easing, FadeIn, FadeInUp, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

// Hold the list while paper closes, then make room as the parcel lifts away.
// Shared by the real boards and their preview; saving still happens immediately.
export const completionLayout = LinearTransition.delay(380).duration(300)
  .easing(Easing.inOut(Easing.cubic)).reduceMotion(ReduceMotion.System);
export const completionExit = FadeOut.duration(60).reduceMotion(ReduceMotion.System);
export const completionEnter = FadeIn.delay(380).duration(240).reduceMotion(ReduceMotion.System);
export const countEnter = FadeInUp.duration(180).reduceMotion(ReduceMotion.System);
