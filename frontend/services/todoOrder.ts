import type { Todo } from './todos.api';

export function sortTodoGroup(todos: Todo[]): Todo[] {
  return [...todos].sort((left, right) => {
    const leftOrder = left.sort_order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    const anchor = (todo: Todo) => {
      const date = todo.planned_at ?? todo.deadline;
      return date ? new Date(date).getTime() : Number.MAX_SAFE_INTEGER;
    };
    return anchor(left) - anchor(right) || left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id);
  });
}

// Replace only the visible slots when filtering. Hidden tasks keep their
// places, and the resulting ranks describe the entire importance group.
export function orderTodoGroup(todos: Todo[], orderedIds: string[]): Todo[] {
  if (orderedIds.length < 2 || new Set(orderedIds).size !== orderedIds.length) return [];
  const byId = new Map(todos.filter((todo) => todo.status === 'pending').map((todo) => [todo.id, todo]));
  const selected = orderedIds.map((id) => byId.get(id));
  const priority = selected[0]?.priority;
  if (!priority || selected.some((todo) => !todo || todo.priority !== priority)) return [];
  const group = sortTodoGroup([...byId.values()].filter((todo) => todo.priority === priority));
  const visible = new Set(orderedIds);
  let index = 0;
  return group
    .map((todo) => visible.has(todo.id) ? byId.get(orderedIds[index++])! : todo)
    .map((todo, sort_order) => ({ ...todo, sort_order }))
    .filter((todo) => todo.sort_order !== byId.get(todo.id)?.sort_order);
}

export function moveTask<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export function dragTarget(heights: number[], from: number, distance: number): number {
  let traveled = 0;
  let to = from;
  const direction = distance < 0 ? -1 : 1;
  for (let index = from + direction; index >= 0 && index < heights.length; index += direction) {
    if (Math.abs(distance) >= traveled + heights[index] / 2) to = index;
    traveled += heights[index];
  }
  return to;
}
