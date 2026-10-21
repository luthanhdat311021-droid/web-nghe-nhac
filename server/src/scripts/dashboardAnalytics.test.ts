import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsWindow, buildDailyAnalytics } from '../services/dashboardAnalytics.js';

test('dashboard window contains today and previous six Vietnam calendar days', () => {
  const now = new Date('2026-10-21T18:30:00Z'); // 01:30 on 22/10 in Vietnam
  const window = analyticsWindow(now);
  assert.equal(window.start.toISOString(), '2026-10-15T17:00:00.000Z');
  assert.equal(window.end, now);
});

test('daily analytics fills missing dates with zero and keeps real totals', () => {
  const start = new Date('2026-10-14T17:00:00Z');
  const data = buildDailyAnalytics(start,
    [{ day: '2026-10-15', value: 3 }, { day: '2026-10-21', value: 2 }],
    [{ day: '2026-10-16', value: 1 }],
    [{ day: '2026-10-21', value: 100000 }]);
  assert.equal(data.length, 7);
  assert.deepEqual(data[0], { date: '2026-10-15', name: '15/10', plays: 3, newUsers: 0, revenue: 0 });
  assert.deepEqual(data[6], { date: '2026-10-21', name: '21/10', plays: 2, newUsers: 0, revenue: 100000 });
});
