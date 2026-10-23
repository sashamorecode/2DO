import test from 'node:test';
import assert from 'node:assert/strict';
import { loadService } from './load-service.mjs';

const entry = (id, rank) => ({ id, resourceId: 'task', resource: 'todo', op: 'upsert', payload: { id: 'task', sort_order: rank } });

test('a second drag during sync is flushed before fetching server state', async () => {
  let queue = [entry('first', 1)];
  let acceptFirst;
  const gate = new Promise(resolve => { acceptFirst = resolve; });
  const sent = [];
  const reconciled = [];
  const { processSyncQueue } = loadService('sync', {
    './networkStatus': { getIsOnline: () => true },
    './offlineQueue': {
      getQueue: () => queue,
      useOfflineQueue: { getState: () => ({ queue, removeMany: ids => { queue = queue.filter(item => !ids.includes(item.id)); } }) },
    },
    './todos.api': { todosApi: { sync: async payload => { sent.push(payload); if (sent.length === 1) await gate; return { todos: [], tags: [] }; } } },
    './queryClient': { queryClient: { invalidateQueries: async key => { reconciled.push({ key, queueLength: queue.length, sent: sent.length }); } } },
    '../store/authStore': { useAuthStore: { getState: () => ({ token: 'test' }) } },
  });
  const running = processSyncQueue();
  queue = [entry('second', 0)];
  await processSyncQueue();
  acceptFirst();
  await running;
  assert.deepEqual(sent.map(payload => payload.todos[0].sort_order), [1, 0]);
  assert.deepEqual(queue, []);
  assert.ok(reconciled.every(call => call.queueLength === 0 && call.sent === 2));
});

test('failed ordering sync retains persisted entries for reconnect', async () => {
  let queue = [entry('pending', 0)];
  const { processSyncQueue } = loadService('sync', {
    './networkStatus': { getIsOnline: () => true },
    './offlineQueue': { getQueue: () => queue, useOfflineQueue: { getState: () => ({ queue, removeMany: () => assert.fail('must retain queue') }) } },
    './todos.api': { todosApi: { sync: async () => { throw new Error('Offline'); } } },
    './queryClient': { queryClient: { invalidateQueries: () => assert.fail('must retain local order') } },
    '../store/authStore': { useAuthStore: { getState: () => ({ token: 'test' }) } },
  });
  await processSyncQueue();
  assert.equal(queue[0].payload.sort_order, 0);
});

test('refetching and editing preserve a locally queued order', async () => {
  const todo = { id: 'task', sort_order: 8 };
  const { todosApi } = loadService('todos.api', {
    './api': { api: { get: async url => ({ data: url === '/todos' ? [todo] : todo }), put: async () => ({ data: todo }) } },
    './offlineQueue': { getQueue: () => [entry('queued', 0)] },
  });
  assert.equal((await todosApi.list())[0].sort_order, 0);
  assert.equal((await todosApi.get('task')).sort_order, 0);
  assert.equal((await todosApi.update('task', {})).sort_order, 0);
  assert.deepEqual(await loadService('todos.api', {
    './api': { api: { get: async () => ({ data: null }) } },
    './offlineQueue': { getQueue: () => [] },
  }).todosApi.list(), []);
});

test('completion while an order is saving follows the same queue', async () => {
  const todo = { id: 'task', title: 'Task', user_id: 'user', priority: 'B', status: 'pending', sort_order: 0, tags: [], steps: [] };
  let queue = [entry('order-saving', 0)];
  const cache = new Map([['todos,pending', [todo]]]);
  let flushed = false;
  const { useOfflineTodoOps } = loadService('todos.api.offline', {
    './networkStatus': { getIsOnline: () => true },
    './offlineQueue': { useOfflineQueue: { getState: () => ({
      queue,
      enqueue: mutation => { queue = [mutation]; },
    }) } },
    './todos.api': { todosApi: { complete: () => assert.fail('must serialize behind order sync') } },
    './todoOrder': {},
    './sync': { processSyncQueue: async () => { flushed = true; } },
  });
  const qc = {
    getQueryData: key => cache.get(key.join()),
    setQueryData: (key, update) => cache.set(key.join(), typeof update === 'function' ? update(cache.get(key.join())) : update),
  };
  const completed = await useOfflineTodoOps(qc, 'user').completeTodo('task');
  assert.equal(completed.status, 'completed');
  assert.equal(queue[0].payload.status, 'completed');
  assert.equal(queue[0].payload.sort_order, 0);
  assert.ok(flushed);
});
