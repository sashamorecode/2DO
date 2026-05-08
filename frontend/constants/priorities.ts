import { colors } from './colors';

export type Priority = 'A' | 'B' | 'C';

export const PRIORITY_ORDER: Priority[] = ['A', 'B', 'C'];

export const PRIORITIES: Record<
  Priority,
  { label: string; short: string; color: string; description: string }
> = {
  A: { label: 'Must-Do', short: 'Must', color: colors.priorityA, description: 'Has to happen' },
  B: { label: 'Should-Do', short: 'Should', color: colors.priorityB, description: 'Important' },
  C: { label: 'Can-Do', short: 'Can', color: colors.priorityC, description: 'If there is time' },
};
