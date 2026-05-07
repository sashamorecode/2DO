import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

export interface ConfettiOverlayRef {
  fire: (x: number, y: number) => void;
}

export const ConfettiOverlay = forwardRef<ConfettiOverlayRef>((_, ref) => {
  const cannonRef = useRef<ConfettiCannon>(null);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const [visible, setVisible] = React.useState(false);

  useImperativeHandle(ref, () => ({
    fire(x: number, y: number) {
      setPos({ x, y });
      setVisible(true);
      setTimeout(() => setVisible(false), 3000);
    },
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ConfettiCannon
        ref={cannonRef}
        count={80}
        origin={{ x: pos.x, y: pos.y }}
        autoStart
        fadeOut
        colors={['#6366f1', '#22c55e', '#f97316', '#ef4444', '#eab308', '#3b82f6']}
      />
    </View>
  );
});

ConfettiOverlay.displayName = 'ConfettiOverlay';
