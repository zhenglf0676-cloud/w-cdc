import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedCompany, analysisArgs, summarize } from '../src/lib/water-assistant/analysis';
import type { Reading } from '../src/lib/water-reports/model';
test('企业不能读取其他企业，管理员不能跨园区', () => {
  const company = { user_id: 'other', park_name: 'A' };
  assert.equal(allowedCompany({ role: 'enterprise', userId: 'self', park: 'A' }, company), false);
  assert.equal(allowedCompany({ role: 'admin', userId: 'admin', park: 'B' }, company), false);
  assert.equal(allowedCompany({ role: 'admin', userId: 'admin', park: 'A' }, company), true);
});
test('工具参数拒绝越权字段和过长日期', () => {
  assert.equal(analysisArgs.safeParse({ startDate: '2026-01-01', endDate: '2026-01-07', userId: 'other' }).success, false);
  assert.equal(analysisArgs.safeParse({ startDate: '2026-01-01', endDate: '2026-03-01' }).success, false);
});
test('统计保留零值、不把缺阈值判为正常、按北京时间分组', () => {
  const base: Reading = { id: '1', outlet_id: 'o', pollutant_type: 'cod', value: 0, unit: 'mg/L', standard_limit: 1, monitored_at: '2026-01-01T16:00:00Z' };
  const result = summarize([base, { ...base, id: '2', value: 2 }, { ...base, id: '3', value: 4, standard_limit: null }])[0];
  assert.equal(result.mean, 2); assert.equal(result.exceedances, 1); assert.equal(result.missingThreshold, 1);
  assert.equal(result.daily[0].date, '2026-01-02'); assert.equal(result.evidence[0].id, '2');
});
