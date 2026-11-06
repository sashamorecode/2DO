import type { BodyDoubleSession } from './bodyDouble.api';
import type { Todo } from './todos.api';
import { getDayKeyInTimeZone } from './todoDates';

export function visibleBodyDoubleSessions(
  sessions: BodyDoubleSession[], today: string, timezone?: string, localTodos: Todo[] = []
): BodyDoubleSession[] {
  const localById = new Map(localTodos.map((todo) => [todo.id, todo]));
  return sessions.filter((session) => {
    const day = getDayKeyInTimeZone(session.scheduled_at, timezone);
    if (!day || day < today) return false;
    const local = session.todo_id ? localById.get(session.todo_id) : undefined;
    // Local completion/reopening should take effect immediately, even offline.
    // A newer server snapshot must still win over an older cached task.
    const todo = local && (!session.todo || Date.parse(local.updated_at) >= Date.parse(session.todo.updated_at))
      ? local : session.todo;
    return todo?.status !== 'completed';
  });
}
