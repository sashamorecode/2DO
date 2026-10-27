import type { Todo } from './todos.api';
import { getEffectiveTimeZone } from './timezone';

export function getDayKeyInTimeZone(value: string | Date, timezone?: string): string | null {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: getEffectiveTimeZone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isTodoOnDay(todo: Todo, dayKey: string, timezone?: string): boolean {
  return todo.status === 'pending' && [todo.planned_at, todo.deadline].some(
    (date) => !!date && getDayKeyInTimeZone(date, timezone) === dayKey
  );
}
