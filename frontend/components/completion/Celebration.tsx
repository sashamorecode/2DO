import React, {
  createRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import { colors } from '../../constants/colors';

// Singleton imperative handle so any component can trigger a celebration
// without having to thread refs through the tree. The host overlay is mounted
// once at the app root and stays alive across TodoCard unmounts.
export interface CelebrationOverlayRef {
  fire: (x: number, y: number, accent: string) => void;
}

const handleRef = createRef<CelebrationOverlayRef>();

export function celebrate(x: number, y: number, accent: string) {
  handleRef.current?.fire(x, y, accent);
}

const SHARD_COUNT = 14;
const CONFETTI_COLORS = ['#C0A2BE', '#9A6395', '#E07A91', '#E5B868', '#88B0A8', '#FFF5FB', '#772770'];

interface PieceData {
  id: number;
  size: number;
  color: string;
  dx: number;
  dy: number;
  rotation: number;
  delay: number;
  borderRadius: number;
}

interface Burst {
  id: number;
  centerX: number;
  centerY: number;
  pieces: PieceData[];
  confettiKey: number;
}

function generatePieces(accent: string): PieceData[] {
  const palette = [accent, accent, colors.accentLight, colors.accentMuted, colors.text];
  return Array.from({ length: SHARD_COUNT }, (_, i) => {
    // Spread shards in a full circle but with jitter so it doesn't look mechanical.
    const angle = (Math.PI * 2 * i) / SHARD_COUNT + (Math.random() - 0.5) * 0.5;
    const distance = 130 + Math.random() * 120;
    return {
      id: i,
      size: 14 + Math.random() * 18,
      color: palette[Math.floor(Math.random() * palette.length)],
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      rotation: (Math.random() - 0.5) * 900,
      delay: Math.random() * 70,
      borderRadius: Math.random() < 0.5 ? 3 : 999, // mix rounded squares + dots
    };
  });
}

export const CelebrationOverlay = forwardRef<CelebrationOverlayRef>((_, ref) => {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const idRef = useRef(0);

  useImperativeHandle(ref, () => ({
    fire(x, y, accent) {
      const id = ++idRef.current;
      const burst: Burst = {
        id,
        centerX: x,
        centerY: y,
        pieces: generatePieces(accent),
        confettiKey: id,
      };
      setBursts((prev) => [...prev, burst]);
      // Each burst self-cleans after ~6000ms, leaving room for fall + fade.
      setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== id));
      }, 6000 + 1200 + 400 /* max delay + anim duration + fade buffer */);
    },
  }));

  if (bursts.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bursts.map((b) => (
        <View key={b.id} style={StyleSheet.absoluteFill} pointerEvents="none">
          {b.pieces.map((p) => (
            <Shard key={p.id} piece={p} centerX={b.centerX} centerY={b.centerY} />
          ))}
          <ConfettiCannon
            key={`confetti-${b.confettiKey}`}
            count={120}
            origin={{ x: b.centerX, y: b.centerY }}
            explosionSpeed={650}
            fallSpeed={3000}
            autoStart
            fadeOut={true}
            colors={CONFETTI_COLORS}
          />
        </View>
      ))}
    </View>
  );
});

CelebrationOverlay.displayName = 'CelebrationOverlay';

function Shard({
  piece,
  centerX,
  centerY,
}: {
  piece: PieceData;
  centerX: number;
  centerY: number;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const op = useSharedValue(0);
  const scale = useSharedValue(0.4);

  useEffect(() => {
    // Pop in fast.
    op.value = withTiming(1, { duration: 50 });
    scale.value = withTiming(1, { duration: 30, easing: Easing.out(Easing.back(1.8)) });
    // Outward + downward arc (gravity bias on Y).
    tx.value = withDelay(
      piece.delay,
      withTiming(piece.dx, { duration: 1200, easing: Easing.out(Easing.cubic) })
    );
    ty.value = withDelay(
      piece.delay,
      withTiming(piece.dy + 260, { duration: 1200, easing: Easing.in(Easing.cubic) })
    );
    rot.value = withDelay(
      piece.delay,
      withTiming(piece.rotation, { duration: 1200, easing: Easing.out(Easing.quad) })
    );

    // Late fade.
    op.value = withDelay(
      6000 + piece.delay,
      withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) })
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotateZ: `${rot.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.shard,
        {
          left: centerX - piece.size / 2,
          top: centerY - piece.size / 2,
          width: piece.size,
          height: piece.size,
          backgroundColor: piece.color,
          borderRadius: piece.borderRadius,
        },
        animStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  shard: { position: 'absolute' },
});

export function CelebrationHost() {
  return <CelebrationOverlay ref={handleRef} />;
}
