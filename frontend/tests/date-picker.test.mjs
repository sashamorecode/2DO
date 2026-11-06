import test from 'node:test';
import assert from 'node:assert/strict';
import { loadService } from './load-service.mjs';
const { calendarDays, applyTime } = loadService('datePicker', {});

test('calendar lays out leap years, six-week months and year boundaries', () => {
  for (const [year, month, days] of [[2024, 1, 29], [2026, 1, 28], [2026, 7, 31], [2026, 11, 31], [2027, 0, 31]]) {
    const grid = calendarDays(year, month);
    assert.equal(grid.length % 7, 0);
    assert.equal(grid.filter(Boolean).length, days);
    grid.forEach((day, index) => {
      if (!day) return;
      assert.equal(day.getDay(), index % 7);
      assert.equal(day.getFullYear(), year);
      assert.equal(day.getMonth(), month);
    });
  }
  assert.equal(calendarDays(2026, 7).length, 42);
});

test('time editing preserves the calendar date and rejects invalid input', () => {
  const original = new Date(2026, 11, 25, 9, 30);
  for (const [h, m] of [['0', '00'], ['23', '59'], ['09', '05']]) {
    const result = applyTime(original, h, m);
    assert.equal(result.toDateString(), original.toDateString());
    assert.equal(result.getHours(), Number(h));
    assert.equal(result.getMinutes(), Number(m));
  }
  for (const [h, m] of [['24', '00'], ['9', '60'], ['', '00'], ['-1', '10'], ['a', '1'], ['1', '1.5']]) {
    assert.equal(applyTime(original, h, m), null);
  }
  assert.equal(original.getHours(), 9);
  assert.equal(original.getMinutes(), 30);
});
