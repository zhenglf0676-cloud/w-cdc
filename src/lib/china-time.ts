/** Beijing calendar dates, independent of browser/server timezone. End is exclusive. */
const DAY = 86400000;
const OFFSET = 8 * 60 * 60 * 1000;
export const chinaDay = (value: string | number | Date) => new Date(new Date(value).getTime() + OFFSET).toISOString().slice(0, 10);
export function chinaPeriod(start: unknown, end: unknown) {
  const valid = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!valid(start) || !valid(end) || start > end) throw new Error('请选择有效的起止日期');
  return { start, end, from: new Date(Date.parse(start) - OFFSET).toISOString(), to: new Date(Date.parse(end) - OFFSET + DAY).toISOString(), days: (Date.parse(end) - Date.parse(start)) / DAY + 1 };
}
export const shiftChinaDay = (day: string, count: number) => new Date(Date.parse(day) + count * DAY).toISOString().slice(0, 10);
export function recentChinaDays(days: number, now: Date = new Date()) {
  if (!Number.isInteger(days) || days < 1) throw new Error('天数必须为正整数');
  const end = chinaDay(now);
  return chinaPeriod(shiftChinaDay(end, 1 - days), end);
}
