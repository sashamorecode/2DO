import React, { createRef, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, Extrapolation, interpolate, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { SantaSleigh } from './SantaSleigh';

interface WrappedTask {
  x: number;
  y: number;
  width: number;
  height: number;
  content: React.ReactNode;
}
interface Flight extends WrappedTask { id: number }
interface CelebrationOverlayRef { fire: (task: WrappedTask) => void }
const handleRef = createRef<CelebrationOverlayRef>();
export function celebrate(task: WrappedTask) { handleRef.current?.fire(task); }

const DURATION = 4000;
const bow = `<svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" fill="none"><path d="M50 43C-5 45 5-9 29 12L50 43ZM50 43C105 45 95-9 71 12L50 43Z" fill="#E8C478" stroke="#F4DCA3" stroke-width="4"/><path d="M48 41 27 65l-1-14-13 2 29-17M52 41l21 24 1-14 13 2-29-17" fill="#E8C478"/><ellipse cx="50" cy="40" rx="9" ry="7" fill="#F4DCA3"/></svg>`;

// A root-level snapshot survives the local-first mutation removing the real row.
// Completion never waits for animation callbacks, app foregrounding, or a network request.
const CelebrationOverlay = forwardRef<CelebrationOverlayRef>((_, ref) => {
  const [flights, setFlights] = useState<Flight[]>([]);
  const root = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const nextId = useRef(0);
  const enabled = useRef(false);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    let reduced = true;
    const refresh = () => {
      enabled.current = !reduced && AppState.currentState === 'active';
      if (!enabled.current) setFlights([]);
    };
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      preferenceChanged = true;
      reduced = value;
      refresh();
    });
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted && !preferenceChanged) { reduced = value; refresh(); }
    }).catch(() => {});
    const state = AppState.addEventListener('change', refresh);
    return () => {
      mounted = false;
      enabled.current = false;
      motion.remove();
      state.remove();
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, []);

  useImperativeHandle(ref, () => ({ fire(task) {
    if (!enabled.current) return;
    const id = ++nextId.current;
    setFlights(previous => [...previous.slice(-2), {
      ...task, id, x: task.x - origin.current.x, y: task.y - origin.current.y,
    }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setFlights(previous => previous.filter(flight => flight.id !== id));
    }, DURATION + 150);
    timers.current.add(timer);
  } }), []);

  return <View ref={root} collapsable={false} pointerEvents="none" accessible={false}
    accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={styles.overlay} onLayout={() => root.current?.measureInWindow((x, y) => { origin.current = { x, y }; })}>
    {flights.map(flight => <GiftFlight key={flight.id} task={flight} viewportWidth={width} viewportHeight={height} />)}
  </View>;
});
CelebrationOverlay.displayName = 'CelebrationOverlay';

// Keep the shared-value read inside each mapper. A worklet helper that closes
// over time hides it from Reanimated's mapper input discovery and freezes styles.
function sample(elapsed: number, points: number[], values: number[]) {
  'worklet';
  return interpolate(elapsed, points, values, Extrapolation.CLAMP);
}

function GiftFlight({ task, viewportWidth, viewportHeight }: { task: Flight; viewportWidth: number; viewportHeight: number }) {
  const time = useSharedValue(0);
  const { x, y, width, height } = task;
  const sx = Math.max(4, Math.min(viewportWidth - 234, x + width / 2 - 115));
  const sy = Math.max(20, Math.min(viewportHeight - 170, y - 38));
  const giftX = x + width / 2 - 52;
  const exitX = viewportWidth - sx + 250;
  useEffect(() => {
    time.value = withTiming(DURATION, { duration: DURATION, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    return () => cancelAnimation(time);
  }, [time]);
  // The gift and sleigh share the exact departure transform once loaded.
  const departure = (elapsed: number) => {
    'worklet';
    return [
      { translateX: sample(elapsed, [2950, 3150, 4000], [0, -14, exitX]) },
      { translateY: sample(elapsed, [2950, 3150, 4000], [0, 8, -300]) },
      { rotate: `${sample(elapsed, [2950, 3150, 4000], [0, -7, -18])}deg` },
      { scale: sample(elapsed, [3150, 4000], [1, 0.6]) },
    ];
  };
  const vehicleStyle = useAnimatedStyle(() => ({
    opacity: sample(time.value, [1650, 1680, 3850, 4000], [0, 1, 1, 0]),
    transform: [
      { translateX: sample(time.value, [1650, 2250, 2950, 3150, 4000], [-sx - 260, 0, 0, -14, exitX]) },
      { translateY: sample(time.value, [1650, 2250, 2750, 2850, 2950, 3150, 4000], [45, 0, 0, 7, 0, 8, -300]) },
      { rotate: `${sample(time.value, [1650, 2250, 2950, 3150, 4000], [-8, 0, 0, -7, -18])}deg` },
      { scale: sample(time.value, [3150, 4000], [1, 0.6]) },
    ],
  }));
  const parcelStage = useAnimatedStyle(() => ({
    opacity: sample(time.value, [3850, 4000], [1, 0]),
    transform: departure(time.value),
  }));
  const parcel = useAnimatedStyle(() => ({
    left: sample(time.value, [0, 900, 1250, 2250, 2500, 2750], [x - sx, x - sx, giftX - sx, giftX - sx, 30, 40]),
    top: sample(time.value, [0, 2250, 2500, 2750, 2850, 2950], [y - sy, y - sy, -25, 54, 61, 54]),
    width: sample(time.value, [900, 1250, 2250, 2750], [width, 104, 104, 56]),
    height: sample(time.value, [900, 1250, 2250, 2750], [height, 88, 88, 48]),
    transform: [{ rotate: `${sample(time.value, [2250, 2500, 2750], [0, -14, -5])}deg` }],
  }));
  const snapshot = useAnimatedStyle(() => ({ opacity: sample(time.value, [650, 900], [1, 0]) }));
  const left = useAnimatedStyle(() => ({ transform: [{ translateX: sample(time.value, [120, 420], [-width, 0]) }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ translateX: sample(time.value, [400, 690], [width, 0]) }] }));
  const bottom = useAnimatedStyle(() => ({ transform: [{ translateY: sample(time.value, [650, 900], [height, 0]) }] }));
  const vertical = useAnimatedStyle(() => ({ transform: [{ scaleY: sample(time.value, [1250, 1450], [0, 1]) }] }));
  const horizontal = useAnimatedStyle(() => ({ transform: [{ scaleX: sample(time.value, [1300, 1500], [0, 1]) }] }));
  const bowStyle = useAnimatedStyle(() => ({ transform: [{ scale: sample(time.value, [1450, 1620, 1700], [0, 1.15, 1]) }] }));

  return <>
    <Animated.View style={[styles.stage, { left: sx, top: sy }, parcelStage]}>
      <Animated.View style={[styles.parcel, parcel]}>
        <View style={styles.shell}>
          <Animated.View style={[{ width: task.width, height: task.height }, snapshot]}>{task.content}</Animated.View>
          <Animated.View style={[styles.paper, styles.paperLeft, left]}><PaperPattern /></Animated.View>
          <Animated.View style={[styles.paper, styles.paperRight, right]}><PaperPattern /></Animated.View>
          <Animated.View style={[styles.paper, styles.paperBottom, bottom]}><PaperPattern /></Animated.View>
          <Animated.View style={[styles.horizontal, horizontal]} />
          <Animated.View style={[styles.vertical, vertical]} />
        </View>
        <Animated.View style={[styles.bow, bowStyle]}><SvgXml xml={bow} width={64} height={45} /></Animated.View>
      </Animated.View>
    </Animated.View>
    <Animated.View style={[styles.stage, { left: sx, top: sy }, vehicleStyle]}><SantaSleigh /></Animated.View>
    {Array.from({ length: 12 }, (_, index) => <Sparkle key={index} time={time} index={index} x={sx} y={sy} />)}
  </>;
}

function PaperPattern() {
  return <View style={StyleSheet.absoluteFill}>
    {Array.from({ length: 24 }, (_, i) => <View key={i} style={{ position: 'absolute', left: `${(i % 6) * 18 + 5}%`, top: `${Math.floor(i / 6) * 28 + 5}%`, width: 3, height: 3, borderRadius: 2, backgroundColor: '#F4DCA380' }} />)}
  </View>;
}

function Sparkle({ time, index, x, y }: { time: { value: number }; index: number; x: number; y: number }) {
  const start = 3000 + index * 35;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(time.value, [start, start + 100, start + 600], [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(time.value, [start, start + 600], [0, 30], Extrapolation.CLAMP) },
      { scale: interpolate(time.value, [start, start + 100, start + 600], [0.2, 1, 0], Extrapolation.CLAMP) },
    ],
  }));
  return <Animated.Text style={[styles.spark, { left: x + 25 + index * 12, top: y + 115 - index * 6 }, style]}>✦</Animated.Text>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, overflow: 'hidden' },
  stage: { position: 'absolute', width: 230, height: 150 },
  parcel: { position: 'absolute' },
  shell: { ...StyleSheet.absoluteFillObject, borderRadius: 14, overflow: 'hidden' },
  paper: { position: 'absolute', top: 0, bottom: 0, borderWidth: 1, borderColor: '#ED879560' },
  paperLeft: { left: 0, right: '48%', backgroundColor: '#B74356' },
  paperRight: { left: '48%', right: 0, backgroundColor: '#C65362' },
  paperBottom: { top: '52%', left: 0, right: 0, backgroundColor: '#A93649', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  horizontal: { position: 'absolute', top: '42%', height: '16%', width: '100%', backgroundColor: '#E8C478', borderTopWidth: 2, borderColor: '#F4DCA3' },
  vertical: { position: 'absolute', left: '42.5%', width: '15%', height: '100%', backgroundColor: '#E8C478', borderLeftWidth: 2, borderColor: '#F4DCA3' },
  bow: { position: 'absolute', width: 64, height: 45, left: '50%', marginLeft: -32, top: -20 },
  spark: { position: 'absolute', color: '#F4DCA3', fontSize: 18 },
});

export function CelebrationHost() { return <CelebrationOverlay ref={handleRef} />; }
