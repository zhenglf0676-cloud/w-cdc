import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparisonArgs, comparisonRanges, normalReference, compareCompanyPeriods } from '../src/lib/water-assistant/history';
import { analyze, type Reading } from '../src/lib/water-reports/model';

const reading = (day: number, value: number, limit: number | null = 5, pollutant = 'cod'): Reading => ({
  id: `r-${day}-${value}-${pollutant}`, outlet_id: 'outlet', pollutant_type: pollutant, value, unit: 'mg/L', standard_limit: limit,
  monitored_at: `2026-09-${String(day).padStart(2, '0')}T16:00:00Z`,
});

test('历史比较默认用当前7天和此前28天，北京时间首尾均包含', () => {
  const ranges = comparisonRanges({}, new Date('2026-10-19T03:00:00Z'));
  assert.deepEqual([ranges.current.start, ranges.current.end, ranges.baseline.start, ranges.baseline.end], ['2026-10-13', '2026-10-19', '2026-09-15', '2026-10-12']);
  assert.equal(comparisonArgs.safeParse({ baselineStartDate: '2026-10-12' }).success, false);
  assert.equal(comparisonArgs.safeParse({ currentStartDate: '2026-10-10', currentEndDate: '2026-10-19', baselineStartDate: '2026-10-12', baselineEndDate: '2026-10-18' }).success, false);
  assert.equal(comparisonArgs.safeParse({ userId: 'someone-else' }).success, false);
});

test('历史正常参考排除超上限日、缺阈值日和 pH；不删掉异常日的其余记录后冒充正常', () => {
  const records = [reading(1, 1), reading(2, 2), reading(3, 1), reading(4, 2), reading(5, 1), reading(6, 8), reading(6, 2), reading(7, 2, null)];
  const normal = normalReference(records, 'cod', 'mg/L');
  assert.equal(normal.days, 5);
  assert.equal(normal.excludedDays, 2);
  assert.equal(normal.stats?.av, 1.4);
  assert.equal(normalReference([reading(1, 7, 9, 'ph')], 'ph', 'mg/L').stats, null);
});

test('比较仅在两期样本充分且同单位时解释AV/AD/CV/SKEW，保留CDC原值', () => {
  const companies = [{ id: 'one', user_id: 'u', company_name: '甲企业', park_name: '园区' }];
  const outlets = [{ id: 'outlet', user_id: 'u', name: '一号口' }];
  const pollutants = { one: [{ id: 'cod', label: 'COD', unit: 'mg/L' }] };
  const older = analyze(companies, outlets, [reading(1, 1), reading(2, 2), reading(3, 1), reading(4, 2), reading(5, 8)], pollutants)[0];
  const newer = analyze(companies, outlets, [reading(6, 3), reading(7, 4), reading(8, 5), reading(9, 6)], pollutants)[0];
  const result = compareCompanyPeriods('甲企业', newer, older);
  assert.equal(result.pollutants[0].normalReference.days, 4);
  assert.equal(result.pollutants[0].comparable, true);
  assert(result.pollutants[0].change!.av > 0);
  assert.equal(result.pollutants[0].outletWarnings[0].name, '一号口');
  assert.equal(result.pollutants[0].current.cdc, newer.metrics[0].cdc);
  const few = compareCompanyPeriods('甲企业', newer, analyze(companies, outlets, [reading(1, 1)], pollutants)[0]);
  assert.equal(few.pollutants[0].comparable, false);
  assert.equal(few.pollutants[0].change, null);
});
