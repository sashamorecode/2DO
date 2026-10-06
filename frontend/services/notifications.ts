import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Todo } from './todos.api';

export const REMINDER_CHANNEL_ID = 'todo-reminders';
const NAMESPACE = 'todo-reminder';

async function getUserScheduledNotifications(userId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter(
    (n) => n.content?.data?.namespace === NAMESPACE && n.content?.data?.userId === userId
  );
}

export type ReminderKind = 'do' | 'due';

export interface ReminderData {
  namespace: string;
  userId: string;
  todoId: string;
  kind: ReminderKind;
  at: number;
  signature: string;
}

export interface PlannedReminder {
  identifier: string;
  data: ReminderData;
  title: string;
  body: string;
  at: number;
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function reminderIdentifier(userId: string, todoId: string, kind: ReminderKind): string {
  return `todo-reminder:${userId}:${todoId}:${kind}`;
}

export function desiredReminders(todos: Todo[], userId: string, now = Date.now()): PlannedReminder[] {
  const out: PlannedReminder[] = [];

  for (const t of todos) {
    if (t.status !== 'pending' || t.user_id !== userId) continue;

    let target: string | null;
    let kind: ReminderKind;

    if (t.priority === 'A') {
      target = t.planned_at;
      kind = 'do';
    } else if (t.priority === 'B') {
      target = t.deadline;
      kind = 'due';
    } else {
      continue;
    }

    const at = target ? new Date(target).getTime() : NaN;
    if (!Number.isFinite(at) || at <= now) continue;

    const title = kind === 'do' ? 'Time to do it' : 'Task due';
    const body = kind === 'do' ? `It's time for "${t.title}".` : `"${t.title}" is due now.`;
    const identifier = reminderIdentifier(userId, t.id, kind);
    const signature = `${at}|${kind}|${t.title}`;

    out.push({
      identifier,
      title,
      body,
      at,
      data: { namespace: NAMESPACE, userId, todoId: t.id, kind, at, signature },
    });
  }

  return out;
}

export async function ensureNotificationSetup(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: 'Task reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    if (existing.status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      return req.status === 'granted';
    }
    return true;
  } catch (e) {
    console.warn('[notifications] Notification setup failed:', e);
    return false;
  }
}

async function settleAll(phase: string, tasks: Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn(`[notifications] ${phase} failed:`, result.reason);
    }
  }
}

async function doSync(userId: string, todos: Todo[]): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const desired = desiredReminders(todos, userId);
    const ours = await getUserScheduledNotifications(userId);
    const existingById = new Map(ours.map((n) => [n.identifier, n]));
    const desiredById = new Map(desired.map((d) => [d.identifier, d]));

    const toCancel: string[] = [];
    for (const [identifier, existing] of existingById) {
      const wanted = desiredById.get(identifier);
      if (!wanted || existing.content.data.signature !== wanted.data.signature) {
        toCancel.push(identifier);
      }
    }

    const toSchedule = desired.filter((d) => {
      const existing = existingById.get(d.identifier);
      return !existing || existing.content.data.signature !== d.data.signature;
    });

    // allSettled so one failing cancel/schedule cannot abort the whole batch.
    await settleAll(
      'cancel',
      toCancel.map((id) => Notifications.cancelScheduledNotificationAsync(id))
    );
    await settleAll(
      'schedule',
      toSchedule.map((d) =>
        Notifications.scheduleNotificationAsync({
          identifier: d.identifier,
          content: {
            title: d.title,
            body: d.body,
            sound: 'default',
            data: { ...d.data },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(d.at),
            channelId: Platform.OS === 'android' ? REMINDER_CHANNEL_ID : undefined,
          },
        })
      )
    );
  } catch (e) {
    console.warn('[notifications] Failed to sync reminders:', e);
  }
}

let chain: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): Promise<void> {
  const run = chain.then(task);
  chain = run.catch(() => {});
  return run;
}

export function syncTodoReminders(userId: string, todos: Todo[] | undefined): Promise<void> {
  if (todos === undefined) return Promise.resolve();
  return enqueue(() => doSync(userId, todos));
}

async function doCancelUserReminders(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const ours = await getUserScheduledNotifications(userId);
    await settleAll(
      'cancel',
      ours.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch (e) {
    console.warn('[notifications] Failed to cancel reminders:', e);
  }
}

// Serialized with syncTodoReminders so an in-flight sync (e.g. from a cache
// change just before logout) can never reschedule reminders after cancellation.
export function cancelUserReminders(userId: string): Promise<void> {
  return enqueue(() => doCancelUserReminders(userId));
}

export async function presentTestNotification(): Promise<void> {
  const ready = await ensureNotificationSetup();
  if (!ready) {
    throw new Error('Notifications are unavailable or permission was not granted.');
  }
  await Notifications.scheduleNotificationAsync({
    identifier: `todo-reminder-test-${Date.now()}`,
    content: {
      title: 'Test notification',
      body: 'If you can see this, notifications work.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      repeats: false,
      channelId: Platform.OS === 'android' ? REMINDER_CHANNEL_ID : undefined,
    },
  });
}
