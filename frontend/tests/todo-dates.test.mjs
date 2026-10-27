import test from 'node:test';
import assert from 'node:assert/strict';
import { loadService } from './load-service.mjs';

const timezone = loadService('timezone', {});
const { getDayKeyInTimeZone, isTodoOnDay } = loadService('todoDates', { './timezone': timezone });
const zone = 'Europe/Berlin';
const today = getDayKeyInTimeZone('2026-10-27T12:00:00Z', zone);
const task = (extra = {}) => ({ status: 'pending', planned_at: null, deadline: null, ...extra });

test('Today includes either a do date or due date today, even when the other date differs', () => {
  const tasks = [
    task({ id: 'do', planned_at: '2026-10-27T09:00:00Z', deadline: '2026-10-30T12:00:00Z' }),
    task({ id: 'due', planned_at: '2026-10-26T09:00:00Z', deadline: '2026-10-27T18:00:00Z' }),
    task({ id: 'both', planned_at: '2026-10-27T09:00:00Z', deadline: '2026-10-27T18:00:00Z' }),
    task({ id: 'undated' }),
    task({ id: 'tomorrow', planned_at: '2026-10-28T09:00:00Z' }),
    task({ id: 'overdue', deadline: '2026-10-26T18:00:00Z' }),
    task({ id: 'completed', deadline: '2026-10-27T09:00:00Z', status: 'completed' }),
  ];
  assert.deepEqual(tasks.filter(todo => isTodoOnDay(todo, today, zone)).map(todo => todo.id), ['do', 'due', 'both']);
});

test('Today compares calendar days in the profile timezone, including both midnight boundaries', () => {
  assert.equal(isTodoOnDay(task({ planned_at: '2026-10-26T23:00:00Z' }), today, zone), true);
  assert.equal(isTodoOnDay(task({ deadline: '2026-10-27T22:59:59Z' }), today, zone), true);
  assert.equal(isTodoOnDay(task({ deadline: '2026-10-26T22:59:59Z' }), today, zone), false);
  assert.equal(isTodoOnDay(task({ deadline: '2026-10-27T23:00:00Z' }), today, zone), false);
  const instant = '2026-10-27T00:30:00Z';
  assert.notEqual(getDayKeyInTimeZone(instant, zone), getDayKeyInTimeZone(instant, 'America/Los_Angeles'));
});

test('Today handles short and long daylight-saving days', () => {
  const springDay = getDayKeyInTimeZone('2026-03-29T12:00:00Z', zone);
  assert.equal(isTodoOnDay(task({ planned_at: '2026-03-28T23:30:00Z' }), springDay, zone), true);
  assert.equal(isTodoOnDay(task({ deadline: '2026-03-29T21:59:59Z' }), springDay, zone), true);
  assert.equal(isTodoOnDay(task({ deadline: '2026-03-29T22:00:00Z' }), springDay, zone), false);
  const autumnDay = getDayKeyInTimeZone('2026-10-25T12:00:00Z', zone);
  for (const date of ['2026-10-24T22:00:00Z', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', '2026-10-25T22:59:59Z']) {
    assert.equal(isTodoOnDay(task({ deadline: date }), autumnDay, zone), true);
  }
});

test('Invalid dates are ignored and an invalid profile timezone uses the existing fallback', () => {
  assert.equal(getDayKeyInTimeZone('invalid', zone), null);
  assert.equal(isTodoOnDay(task({ deadline: 'invalid' }), today, zone), false);
  assert.equal(isTodoOnDay(task({ planned_at: 'invalid', deadline: '2026-10-27T12:00:00Z' }), today, zone), true);
  assert.equal(getDayKeyInTimeZone('2026-10-27T12:00:00Z', 'invalid'), getDayKeyInTimeZone('2026-10-27T12:00:00Z'));
});
