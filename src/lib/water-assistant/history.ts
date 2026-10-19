import { z } from 'zod';
import { chinaDay, chinaPeriod, recentChinaDays, shiftChinaDay } from '../china-time';
import { dailyLatest, exceeded, statistics, type Analysis, type Reading, type Stats } from '../water-reports/model';

export const comparisonArgs = z.object({
  currentStartDate: z.string().optional(), currentEndDate: z.string().optional(),
  baselineStartDate: z.string().optional(), baselineEndDate: z.string().optional(),
  companyName: z.string().max(120).optional(),
}).strict().superRefine((value, ctx) => {
  try { comparisonRanges(value); } catch {
    ctx.addIssue({ code: 'custom', message: '当前期最多31天，历史参考期最多31天，历史期须早于当前期，结束日期不得晚于今天。' });
  }
});

type Args = z.infer<typeof comparisonArgs>;
export function comparisonRanges(args: Args, now = new Date()) {
  if (!!args.currentStartDate !== !!args.currentEndDate || !!args.baselineStartDate !== !!args.baselineEndDate) throw new Error('日期必须成对提供');
  const current = args.currentStartDate && args.currentEndDate ? chinaPeriod(args.currentStartDate, args.currentEndDate) : recentChinaDays(7, now);
  const baseline = args.baselineStartDate && args.baselineEndDate
    ? chinaPeriod(args.baselineStartDate, args.baselineEndDate)
    : chinaPeriod(shiftChinaDay(current.start, -28), shiftChinaDay(current.start, -1));
  if (current.days > 31 || baseline.days > 31 || current.end > chinaDay(now) || baseline.end >= current.start) throw new Error('日期范围无效');
  return { current, baseline };
}

const isUpperLimitComparable = (record: Reading, unit: string) =>
  record.unit === unit && record.standard_limit !== null && Number.isFinite(Number(record.standard_limit));

/** A normal-reference day needs every recorded sample for that pollutant to have a valid upper limit and stay within it. */
export function normalReference(records: Reading[], pollutant: string, unit: string): { days: number; excludedDays: number; stats: Stats | null; daily: { date: string; value: number }[] } {
  if (/^(ph|pH)$/i.test(pollutant)) return { days: 0, excludedDays: 0, stats: null, daily: [] };
  const days = new Map<string, Reading[]>();
  for (const record of records.filter(r => r.pollutant_type === pollutant)) {
    const date = chinaDay(record.monitored_at);
    days.set(date, [...(days.get(date) ?? []), record]);
  }
  const good = [...days.entries()].filter(([, rows]) => rows.every(r => isUpperLimitComparable(r, unit) && !exceeded(r)));
  const daily = Object.entries(dailyLatest(good.flatMap(([, rows]) => rows))[pollutant] ?? {})
    .filter(([, value]) => value > 0).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
  return { days: daily.length, excludedDays: days.size - good.length, stats: statistics(daily.map(point => point.value)), daily };
}

export function compareCompanyPeriods(company: string, current: Analysis[number] | undefined, baseline: Analysis[number] | undefined) {
  const metrics = current?.metrics ?? [];
  const previous = new Map((baseline?.metrics ?? []).map(metric => [metric.id, metric]));
  const outlets = new Map((current?.outlets ?? baseline?.outlets ?? []).map(o => [o.id, o.name]));
  const results = metrics.map(metric => {
    const prior = previous.get(metric.id);
    const nowRecords = (current?.records ?? []).filter(r => r.pollutant_type === metric.id);
    const oldRecords = baseline?.records ?? [];
    const reference = normalReference(oldRecords, metric.id, metric.unit);
    const unitsMatch = [...nowRecords, ...oldRecords.filter(r => r.pollutant_type === metric.id)].every(r => r.unit === metric.unit);
    const currentDays = Object.values(current?.daily[metric.id] ?? {}).filter(value => value > 0).length;
    const currentDaily = Object.entries(current?.daily[metric.id] ?? {}).filter(([, value]) => value > 0).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
    const comparable = unitsMatch && currentDays >= 4 && reference.days >= 4;
    const warnings = nowRecords.filter(exceeded);
    const outletWarnings = [...new Map(warnings.map(record => [record.outlet_id, { name: outlets.get(record.outlet_id) ?? record.outlet_id, count: warnings.filter(w => w.outlet_id === record.outlet_id).length }])).values()]
      .sort((a, b) => b.count - a.count).slice(0, 5);
    return {
      pollutant: metric.id, label: metric.label, unit: metric.unit,
      current: { stats: metric.stats, cdc: metric.cdc, positiveDays: currentDays, records: nowRecords.length, exceedances: warnings.length, missingThreshold: nowRecords.filter(r => r.standard_limit === null).length },
      currentDaily,
      previous: { stats: prior?.stats ?? null, cdc: prior?.cdc ?? null, records: oldRecords.filter(r => r.pollutant_type === metric.id).length },
      normalReference: reference,
      comparable,
      change: comparable && metric.stats && reference.stats ? {
        av: metric.stats.av - reference.stats.av, ad: metric.stats.ad - reference.stats.ad,
        cv: metric.stats.cv - reference.stats.cv, skew: metric.stats.skew - reference.stats.skew,
        avPercent: reference.stats.av > 0 ? (metric.stats.av / reference.stats.av - 1) * 100 : null,
      } : null,
      outletWarnings,
      note: !unitsMatch ? '两期单位不一致，不能对比。' : reference.days < 4 || currentDays < 4 ? '有效日样本不足4天，仅展示已有统计，不判断波动方向。' : null,
    };
  });
  return {
    company, currentCDC: current?.cdc ?? null, previousCDC: baseline?.cdc ?? null,
    currentRecords: current?.records.length ?? 0, previousRecords: baseline?.records.length ?? 0,
    currentExceedances: current?.records.filter(exceeded).length ?? 0,
    previousExceedances: baseline?.records.filter(exceeded).length ?? 0,
    pollutants: results,
  };
}
