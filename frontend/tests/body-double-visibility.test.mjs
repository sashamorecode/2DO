import test from 'node:test';
import assert from 'node:assert/strict';
import { loadService } from './load-service.mjs';

const timezone = loadService('timezone', {});
const dates = loadService('todoDates', { './timezone': timezone });
const { visibleBodyDoubleSessions: visible } = loadService('bodyDoubleVisibility', { './todoDates': dates });
const today = '2026-11-06';
const zone = 'Europe/Berlin';
const session = (id, scheduled_at, todo) => ({ id, scheduled_at, todo, todo_id: todo?.id });
const task = (status, updated_at = '2026-11-06T10:00:00Z') => ({ id: 'task', status, updated_at });

test('past days disappear while today, future and unlinked sessions remain', () => {
  const sessions = [
    session('past', '2026-11-05T22:59:59Z'),
    session('today', '2026-11-05T23:00:00Z'),
    session('future', '2026-11-07T10:00:00Z'),
    session('invalid', 'not-a-date'),
    session('completed', '2026-11-07T10:00:00Z', task('completed')),
  ];
  assert.deepEqual(visible(sessions, today, zone).map(s => s.id), ['today', 'future']);
  assert.deepEqual(visible(sessions, '2026-11-07', zone).map(s => s.id), ['future']);
});

test('completion and reopening take effect against stale session data immediately', () => {
  const pending = session('s', '2026-11-07T10:00:00Z', task('pending'));
  assert.equal(visible([pending], today, zone, [task('completed', '2026-11-06T11:00:00Z')]).length, 0);
  const completed = { ...pending, todo: task('completed') };
  assert.equal(visible([completed], today, zone, [task('pending', '2026-11-06T11:00:00Z')]).length, 1);
  assert.equal(visible([completed], today, zone, [task('pending', '2026-11-06T09:00:00Z')]).length, 0);
  assert.equal(visible([pending], today, zone, [task('completed', '2026-11-06T09:00:00Z')]).length, 1);
});

test('date cutoffs respect the profile timezone and daylight-saving boundaries', () => {
  const s = session('s', '2026-11-06T00:30:00Z');
  assert.equal(visible([s], today, zone).length, 1);
  assert.equal(visible([s], today, 'America/Los_Angeles').length, 0);
  const boundary = [session('past', '2026-03-28T22:59:59Z'), session('today', '2026-03-28T23:00:00Z')];
  assert.deepEqual(visible(boundary, '2026-03-29', zone).map(s => s.id), ['today']);
});
