// Closed-form damped spring: consistent on every frame rate, with no JS timers.
// An impact supplies velocity; energy decays instead of reversing at keyframes.
export function springImpulse(time: number, start: number, amplitude: number, frequency = 24, damping = 7) {
  'worklet';
  const seconds = (time - start) / 1000;
  if (seconds <= 0) return 0;
  return amplitude * Math.exp(-damping * seconds) * Math.sin(frequency * seconds);
}

export function smoothSample(time: number, points: number[], values: number[]) {
  'worklet';
  if (time <= points[0]) return values[0];
  for (let i = 1; i < points.length; i++) {
    if (time <= points[i]) {
      const t = (time - points[i - 1]) / (points[i] - points[i - 1]);
      return values[i - 1] + (values[i] - values[i - 1]) * t * t * (3 - 2 * t);
    }
  }
  return values[values.length - 1];
}

export function giftRebound(time: number) {
  'worklet';
  const t = (time - 1490) / 180;
  // A small ballistic rebound after contact, returning to the same cargo floor.
  return t > 0 && t < 1 ? 6 * 4 * t * (1 - t) : 0;
}
