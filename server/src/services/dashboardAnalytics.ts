import { vietnamDay } from './musicPolicy.js';

export type DailyMetric = { day: string; value: number };
export function analyticsWindow(now = new Date()) {
  const today = vietnamDay(now);
  const todayStart = new Date(`${today}T00:00:00+07:00`);
  return { start: new Date(todayStart.getTime() - 6 * 86400000), end: now };
}
export function buildDailyAnalytics(start: Date, plays: DailyMetric[], users: DailyMetric[], revenue: DailyMetric[]) {
  const indexed = [plays, users, revenue].map(rows => new Map(rows.map(row => [row.day, Number(row.value)])));
  return Array.from({ length: 7 }, (_, offset) => {
    const date = vietnamDay(new Date(start.getTime() + offset * 86400000));
    return { date, name: `${date.slice(8)}/${date.slice(5, 7)}`, plays: indexed[0].get(date) || 0,
      newUsers: indexed[1].get(date) || 0, revenue: indexed[2].get(date) || 0 };
  });
}
