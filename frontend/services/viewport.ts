export function focusScrollDelta(
  viewportTop: number,
  viewportHeight: number,
  inputTop: number,
  inputHeight: number,
  gap: number,
): number {
  'worklet';
  if (viewportHeight <= 0) return 0;
  const bottom = viewportTop + viewportHeight - gap;
  if (inputTop + inputHeight > bottom) return inputTop + inputHeight - bottom;
  if (inputTop < viewportTop + gap) return inputTop - viewportTop - gap;
  return 0;
}
