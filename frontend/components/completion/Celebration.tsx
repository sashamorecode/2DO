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

const DURATION = 2400;
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
  if (elapsed <= points[0]) return values[0];
  for (let i = 1; i < points.length; i++) {
    if (elapsed <= points[i]) {
      const t = (elapsed - points[i - 1]) / (points[i] - points[i - 1]);
      const eased = t * t * (3 - 2 * t);
      return values[i - 1] + (values[i] - values[i - 1]) * eased;
    }
  }
  return values[values.length - 1];
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
  // The loaded gift and sleigh use the same pivot and accelerating exit.
  const departure = (elapsed: number) => {
    'worklet';
    const launch = Math.max(0, Math.min(1, (elapsed - 1770) / 630));
    return [
      { translateX: sample(elapsed, [1640, 1770], [0, -12]) + (exitX + 12) * launch * launch },
      { translateY: sample(elapsed, [1640, 1770], [0, 6]) - 290 * launch * launch },
      { rotate: `${sample(elapsed, [1640, 1770, 2050, 2400], [0, -8, -18, -12])}deg` },
      { scale: sample(elapsed, [1770, 2400], [1, 0.65]) },
    ];
  };
  const vehicleStyle = useAnimatedStyle(() => ({
    opacity: sample(time.value, [620, 660, 2260, 2400], [0, 1, 1, 0]),
    transform: time.value >= 1640 ? departure(time.value) : [
      { translateX: sample(time.value, [620, 1050, 1150], [-sx - 260, 10, 0]) },
      { translateY: sample(time.value, [620, 1050, 1150, 1490, 1560, 1640], [35, -5, 0, 0, 6, 0]) },
      { rotate: `${sample(time.value, [620, 1050, 1150], [-10, 3, 0])}deg` },
      { scale: 1 },
    ],
  }));
  const parcelStage = useAnimatedStyle(() => ({
    opacity: sample(time.value, [2260, 2400], [1, 0]),
    transform: departure(time.value),
  }));
  const parcel = useAnimatedStyle(() => ({
    left: sample(time.value, [0, 380, 720, 1150, 1300, 1490], [x - sx, x - sx, giftX - sx, giftX - sx, 26, 40]),
    top: sample(time.value, [0, 160, 380, 720, 1150, 1300, 1490, 1560, 1640], [y - sy, y - sy - 5, y - sy - 5, y - sy - 24, y - sy - 24, -24, 54, 60, 54]),
    width: sample(time.value, [380, 720, 1150, 1490], [width, 104, 104, 56]),
    height: sample(time.value, [380, 720, 1150, 1490], [height, 88, 88, 48]),
    transform: [
      { rotate: `${sample(time.value, [0, 110, 240, 380, 720, 1150, 1300, 1490], [0, -1.5, 1, 0, -4, -4, -16, -5])}deg` },
      { scale: sample(time.value, [0, 100, 240, 380], [1, 1.025, 0.99, 1]) },
    ],
  }));
  const snapshot = useAnimatedStyle(() => ({ opacity: sample(time.value, [320, 460], [1, 0]) }));
  const left = useAnimatedStyle(() => ({ transform: [{ translateX: sample(time.value, [60, 250], [-width, 0]) }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ translateX: sample(time.value, [190, 370], [width, 0]) }] }));
  const bottom = useAnimatedStyle(() => ({ transform: [{ translateY: sample(time.value, [310, 460], [height, 0]) }] }));
  const vertical = useAnimatedStyle(() => ({ transform: [{ scaleY: sample(time.value, [580, 740], [0, 1]) }] }));
  const horizontal = useAnimatedStyle(() => ({ transform: [{ scaleX: sample(time.value, [620, 780], [0, 1]) }] }));
  const bowStyle = useAnimatedStyle(() => ({ transform: [{ scale: sample(time.value, [700, 810, 890], [0, 1.18, 1]) }] }));

  return <>
    <Animated.View style={[styles.stage, { left: sx, top: sy }, parcelStage]}>
      <Animated.View testID="christmas-parcel" style={[styles.parcel, parcel]}>
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
    <Animated.View testID="christmas-sleigh" style={[styles.stage, { left: sx, top: sy }, vehicleStyle]}><SantaSleigh /></Animated.View>
    {Array.from({ length: 12 }, (_, index) => <Sparkle key={index} time={time} index={index} x={sx} y={sy} />)}
  </>;
}

function PaperPattern() {
  return <View style={StyleSheet.absoluteFill}>
    {Array.from({ length: 24 }, (_, i) => <View key={i} style={{ position: 'absolute', left: `${(i % 6) * 18 + 5}%`, top: `${Math.floor(i / 6) * 28 + 5}%`, width: 3, height: 3, borderRadius: 2, backgroundColor: '#F4DCA380' }} />)}
  </View>;
}

function Sparkle({ time, index, x, y }: { time: { value: number }; index: number; x: number; y: number }) {
  const start = 1740 + index * 22;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(time.value, [start, start + 60, start + 340], [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(time.value, [start, start + 340], [0, 30], Extrapolation.CLAMP) },
      { scale: interpolate(time.value, [start, start + 60, start + 340], [0.2, 1, 0], Extrapolation.CLAMP) },
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
