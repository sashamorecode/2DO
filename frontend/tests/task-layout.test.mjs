import test from 'node:test';
import assert from 'node:assert/strict';
import { loadService } from './load-service.mjs';

const { focusScrollDelta } = loadService('viewport', {});
const { sortTodoGroup, orderTodoGroup, moveTask, dragTarget } = loadService('todoOrder', {});

const task = (id, extra = {}) => ({
  id, priority: 'B', status: 'pending', created_at: '2026-10-23T12:00:00Z',
  deadline: null, planned_at: null, ...extra,
});

test('focus stays inside the measured viewport below headers and above the keyboard', () => {
  assert.equal(focusScrollDelta(150, 250, 380, 44, 24), 48);
  assert.equal(focusScrollDelta(150, 250, 200, 44, 24), 0);
  assert.equal(focusScrollDelta(150, 250, 120, 44, 24), -54);
  assert.equal(focusScrollDelta(150, 0, 380, 44, 24), 0);
});

test('closing the keyboard does not scroll a visible field away', () => {
  assert.equal(focusScrollDelta(100, 700, 400, 80, 24), 0);
});

test('saved order wins over dates; unranked tasks follow by date', () => {
  const tasks = [task('a', { deadline: '2026-10-24', sort_order: 1 }), task('b', { sort_order: 0 }),
    task('c', { planned_at: '2026-10-26' }), task('d', { deadline: '2026-10-25' })];
  assert.deepEqual(sortTodoGroup(tasks).map(t => t.id), ['b', 'a', 'd', 'c']);
  assert.equal(tasks[0].id, 'a');
});

test('reordering filtered tasks preserves hidden slots and other importance groups', () => {
  const tasks = [task('a', { sort_order: 0 }), task('hidden', { sort_order: 1 }),
    task('b', { sort_order: 2 }), task('other', { priority: 'A', sort_order: 0 })];
  const updates = orderTodoGroup(tasks, ['b', 'a']);
  assert.deepEqual(updates.map(t => [t.id, t.sort_order]), [['b', 0], ['a', 2]]);
  assert.equal(tasks[0].sort_order, 0);
});

test('ranks survive multiple drags and tasks restored from a cache without ranks', () => {
  let tasks = [task('a'), task('b'), task('c')];
  for (const ids of [['c', 'a', 'b'], ['b', 'c', 'a']]) {
    const updates = new Map(orderTodoGroup(tasks, ids).map(t => [t.id, t]));
    tasks = tasks.map(t => updates.get(t.id) ?? t);
    assert.deepEqual(sortTodoGroup(JSON.parse(JSON.stringify(tasks))).map(t => t.id), ids);
  }
});

test('invalid, duplicate, completed, and cross-group drag payloads change nothing', () => {
  const tasks = [task('a'), task('b', { priority: 'A' }), task('done', { status: 'completed' })];
  for (const ids of [['a', 'missing'], ['a', 'a'], ['a', 'b'], ['a', 'done'], ['a'], []]) {
    assert.deepEqual(orderTodoGroup(tasks, ids), []);
  }
});

test('drag targets use measured heights and support moving in both directions', () => {
  assert.equal(dragTarget([100, 180, 80], 0, 210), 1);
  assert.equal(dragTarget([100, 180, 80], 0, 400), 2);
  assert.equal(dragTarget([100, 180, 80], 0, 260), 2);
  assert.equal(dragTarget([88, 88], 0, 88), 1);
  assert.equal(dragTarget([100, 180, 80], 2, -400), 0);
  assert.equal(dragTarget([100, 180, 80], 1, 0), 1);
  assert.deepEqual(moveTask(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  const items = ['a', 'b'];
  assert.equal(moveTask(items, 0, -1), items);
  assert.equal(moveTask(items, 1, 2), items);
});
