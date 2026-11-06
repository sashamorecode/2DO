import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, View } from 'react-native';

// Three layers of eight flakes. On mobile, the native driver handles each frame.
const LAYERS = [28000, 22000, 16000];

function SnowLayer({ width, height, layer }: { width: number; height: number; layer: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.timing(progress, {
      toValue: 1,
      duration: LAYERS[layer],
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    }));
    animation.start();
    return () => animation.stop();
  }, [layer, progress]);

  return <>{Array.from({ length: 8 }, (_, index) => {
    const phase = (index + 0.2 + layer * 0.25) / 8;
    const size = 2 + layer + (index % 2);
    const travel = height + 24;
    return (
      <Animated.View
        key={index}
        style={[styles.flake, {
          left: ((index * 0.618 + layer * 0.27) % 1) * Math.max(0, width - 20) + 6,
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: 0.22 + layer * 0.12,
          transform: [
            // Wrap only outside the visible viewport, including on resize.
            { translateY: progress.interpolate({
              inputRange: [0, 1 - phase, 1 - phase + 0.00001, 1],
              outputRange: [-12 + phase * travel, height + 12, -12, -12 + phase * travel],
            }) },
            { translateX: progress.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, index % 2 ? 10 : -10, 0],
            }) },
          ],
        }]}
      />
    );
  })}</>;
}

export function Snowfall() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Wait for the OS preference before starting any decorative motion.
  const [reduceMotion, setReduceMotion] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      preferenceChanged = true;
      setReduceMotion(enabled);
    });
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted && !preferenceChanged) setReduceMotion(enabled);
    }).catch(() => {}); // If unavailable, keep the static Christmas artwork.
    const appState = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => {
      mounted = false;
      motion?.remove();
      appState?.remove();
    };
  }, []);

  return (
    <View
      style={styles.overlay}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={({ nativeEvent: { layout } }) => setSize((previous) =>
        previous.width === layout.width && previous.height === layout.height
          ? previous : { width: layout.width, height: layout.height })}
      testID="viewport-snowfall"
    >
      {active && !reduceMotion && size.width > 0 && size.height > 0 &&
        LAYERS.map((_, layer) => <SnowLayer key={layer} {...size} layer={layer} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 5, overflow: 'hidden' },
  flake: { position: 'absolute', top: 0, backgroundColor: '#F1FAFF' },
});
