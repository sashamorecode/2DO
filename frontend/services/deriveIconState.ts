export type IconState = 'DEFAULT' | 'yellow' | 'red';

export function deriveIconState(
  todos: Array<{ status: string; deadline: string | null; planned_at: string | null }> | undefined,
  now: Date
): IconState {
  const time = now.getTime();
  let state: IconState = 'DEFAULT';
  for (const todo of todos ?? []) {
    if (todo.status !== 'pending') continue;
    if (todo.deadline !== null && new Date(todo.deadline).getTime() < time) return 'red';
    if (todo.planned_at !== null && new Date(todo.planned_at).getTime() < time) state = 'yellow';
  }
  return state;
}
