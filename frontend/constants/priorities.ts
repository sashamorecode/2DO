import { colors } from './colors';

export type Priority = 'A' | 'B' | 'C';

export const PRIORITIES: Record<Priority, { label: string; color: string; description: string }> = {
  A: { label: 'A', color: colors.priorityA, description: 'Urgent & Important' },
  B: { label: 'B', color: colors.priorityB, description: 'Urgent, Not Important' },
  C: { label: 'C', color: colors.priorityC, description: 'Not Urgent' },
};
