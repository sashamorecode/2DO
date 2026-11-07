import React, { createRef, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, Extrapolation, interpolate, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { SantaSleigh } from './SantaSleigh';
import { smoothSample as sample, springImpulse, giftRebound } from './christmasMotion';

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
  // One rigid carrier frame keeps the loaded present on the sleigh, including
  // the landing suspension and launch. Every mapper reads time.value directly.
  const carrier = (elapsed: number) => {
    'worklet';
    const launch = Math.max(0, Math.min(1, (elapsed - 1770) / 630));
    const arrivalX = sample(elapsed, [620, 1050], [-sx - 260, 0]);
    const driveX = elapsed < 1640 ? arrivalX : sample(elapsed, [1640, 1770], [0, -12]) + (exitX + 12) * launch * launch;
    return [
      { translateX: driveX + springImpulse(elapsed, 1050, 14, 22, 9) },
      { translateY: sample(elapsed, [620, 1050, 1640, 1770], [35, 0, 0, 6]) - 290 * launch * launch
        + springImpulse(elapsed, 1050, 4, 24, 9) + springImpulse(elapsed, 1490, 14) },
      { rotate: `${sample(elapsed, [620, 1050, 1640, 1770, 2050, 2400], [-10, 0, 0, -8, -18, -12])
        + springImpulse(elapsed, 1050, -3, 22, 9) + springImpulse(elapsed, 1490, -4)}deg` },
      { scale: sample(elapsed, [1770, 2400], [1, 0.65]) },
    ];
  };
  const vehicleStyle = useAnimatedStyle(() => ({
    opacity: sample(time.value, [620, 660, 2260, 2400], [0, 1, 1, 0]),
    transform: carrier(time.value),
  }));
  const parcelStage = useAnimatedStyle(() => ({
    opacity: sample(time.value, [2260, 2400], [1, 0]),
    transform: time.value >= 1490 ? carrier(time.value) : [
      { translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 },
    ],
  }));
  const parcel = useAnimatedStyle(() => ({
    left: sample(time.value, [0, 380, 720, 1150, 1300, 1490], [x - sx, x - sx, giftX - sx, giftX - sx, 26, 40]),
    top: time.value < 1300
      ? sample(time.value, [0, 160, 380, 720, 1150, 1300], [y - sy, y - sy - 5, y - sy - 5, y - sy - 24, y - sy - 24, -24])
      : -24 + 78 * Math.min(1, (time.value - 1300) / 190) ** 2 - giftRebound(time.value),
    width: sample(time.value, [380, 720, 1150, 1490], [width, 104, 104, 56]),
    height: sample(time.value, [380, 720, 1150, 1490], [height, 88, 88, 48]),
    transform: [
      { rotate: `${sample(time.value, [0, 110, 240, 380, 720, 1150, 1300, 1490], [0, -1.5, 1, 0, -4, -4, -16, -5]) + springImpulse(time.value, 1490, 5, 28, 10)}deg` },
      { scale: sample(time.value, [0, 100, 240, 380], [1, 1.025, 0.99, 1]) },
      { scaleX: 1 + springImpulse(time.value, 1490, 0.07, 32, 16) },
      { scaleY: 1 - springImpulse(time.value, 1490, 0.09, 32, 16) },
    ],
  }));
  const snapshot = useAnimatedStyle(() => ({ opacity: sample(time.value, [320, 460], [1, 0]) }));
  const left = useAnimatedStyle(() => ({ transform: [{ translateX: sample(time.value, [60, 250], [-width, 0]) }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ translateX: sample(time.value, [190, 370], [width, 0]) }] }));
  const bottom = useAnimatedStyle(() => ({ transform: [{ translateY: sample(time.value, [310, 460], [height, 0]) }] }));
  const vertical = useAnimatedStyle(() => ({ transform: [{ scaleY: sample(time.value, [580, 740], [0, 1]) }] }));
  const horizontal = useAnimatedStyle(() => ({ transform: [{ scaleX: sample(time.value, [620, 780], [0, 1]) }] }));
  const bowStyle = useAnimatedStyle(() => ({ transform: [
    { scale: sample(time.value, [700, 800], [0, 1]) + springImpulse(time.value, 800, 0.25, 28, 12) },
    { rotate: `${springImpulse(time.value, 1510, 16, 26, 8)}deg` },
  ] }));

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
    <Animated.View testID="christmas-sleigh" style={[styles.stage, { left: sx, top: sy }, vehicleStyle]}><SantaSleigh time={time} /></Animated.View>
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
  parcel: { position: 'absolute', transformOrigin: '50% 100%' },
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
