import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedCompany, analysisArgs, authorizedReadings, selectAuthorizedCompanies, summarize } from '../src/lib/water-assistant/analysis';
import { contextArgs, recordArgs } from '../src/lib/water-assistant/context';
import { hasRequiredEvidence, requiredEvidenceTool } from '../src/lib/water-assistant/policy';
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
test('所有数据工具共用服务端授权企业筛选，模型传入企业名不能扩大范围', () => {
  const rows = [
    { id: 'a', user_id: 'self', company_name: '甲企业', park_name: 'A' },
    { id: 'b', user_id: 'other', company_name: '乙企业', park_name: 'A' },
    { id: 'c', user_id: 'outside', company_name: '丙企业', park_name: 'B' },
  ];
  assert.deepEqual(selectAuthorizedCompanies({ role: 'enterprise', userId: 'self', park: 'A' }, rows, '乙企业'), []);
  assert.deepEqual(selectAuthorizedCompanies({ role: 'admin', userId: 'manager', park: 'A' }, rows).map(c => c.id), ['a', 'b']);
  assert.deepEqual(selectAuthorizedCompanies({ role: 'admin', userId: 'manager', park: 'A' }, rows, '丙企业'), []);
  assert.equal(contextArgs.safeParse({ companyName: '乙企业', park: 'B' }).success, false);
  assert.equal(recordArgs.safeParse({ recordIds: ['r1'], userId: 'outside' }).success, false);
  assert.equal(recordArgs.safeParse({ recordIds: Array.from({ length: 11 }, (_, i) => `r${i}`) }).success, false);
});
test('按ID核查原始记录时，只返回授权企业的已审批排污口', () => {
  const companies = [
    { id: 'a', user_id: 'self', company_name: '甲', park_name: 'A' },
    { id: 'b', user_id: 'other', company_name: '乙', park_name: 'A' },
    { id: 'c', user_id: 'outside', company_name: '丙', park_name: 'B' },
  ];
  const outlets = [
    { id: 'a', name: '甲口', user_id: 'self', status: 'approved' },
    { id: 'pending', name: '未审批', user_id: 'self', status: 'pending' },
    { id: 'b', name: '乙口', user_id: 'other', status: 'approved' },
    { id: 'c', name: '丙口', user_id: 'outside', status: 'approved' },
  ];
  const records: Reading[] = outlets.map((outlet, i) => ({ id: `r${i}`, outlet_id: outlet.id, pollutant_type: 'cod', value: 1, unit: 'mg/L', standard_limit: 2, monitored_at: '2026-01-01T16:00:00Z' }));
  assert.deepEqual(authorizedReadings({ role: 'enterprise', userId: 'self', park: 'A' }, companies, outlets, records).map(row => row.reading.id), ['r0']);
  assert.deepEqual(authorizedReadings({ role: 'admin', userId: 'manager', park: 'A' }, companies, outlets, records).map(row => row.reading.id), ['r0', 'r2']);
});
test('数据型问题必须有对应工具证据；资料和日常聊天不被强制查库', () => {
  assert.equal(requiredEvidenceTool('我的排污口和审批阈值是什么？'), 'inspect_monitoring_context');
  assert.equal(requiredEvidenceTool('本企业近7天和历史CDC有什么变化？'), 'compare_history');
  assert.equal(requiredEvidenceTool('近7天哪些企业有超阈值记录？'), 'analyze_water');
  assert.equal(requiredEvidenceTool('请核对记录ID r1'), 'inspect_record_evidence');
  assert.equal(requiredEvidenceTool('GB/T 14848适用于排污口吗？'), null);
  assert.equal(requiredEvidenceTool('如何上传监测数据？'), null);
  assert.equal(hasRequiredEvidence('compare_history', new Set(['inspect_monitoring_context'])), false);
  assert.equal(hasRequiredEvidence('analyze_water', new Set(['compare_history'])), true);
});
test('统计保留零值、不把缺阈值判为正常、按北京时间分组', () => {
  const base: Reading = { id: '1', outlet_id: 'o', pollutant_type: 'cod', value: 0, unit: 'mg/L', standard_limit: 1, monitored_at: '2026-01-01T16:00:00Z' };
  const result = summarize([base, { ...base, id: '2', value: 2 }, { ...base, id: '3', value: 4, standard_limit: null }])[0];
  assert.equal(result.mean, 2); assert.equal(result.exceedances, 1); assert.equal(result.missingThreshold, 1);
  assert.equal(result.daily[0].date, '2026-01-02'); assert.equal(result.evidence[0].id, '2');
});
test('pH 单侧上限不触发自动异常结论，缺阈值仍列为无法判定', () => {
  const base: Reading = { id: 'ph1', outlet_id: 'o', pollutant_type: 'ph', value: 10, unit: '', standard_limit: 9, monitored_at: '2026-01-01T16:00:00Z' };
  const result = summarize([base, { ...base, id: 'ph2', pollutant_type: 'cod', standard_limit: null }]);
  assert.equal(result[0].exceedances, 0);
  assert.equal(result[0].unassessable, 1);
  assert.equal(result[0].evidence.length, 0);
  assert.equal(result[1].unassessable, 1);
});
