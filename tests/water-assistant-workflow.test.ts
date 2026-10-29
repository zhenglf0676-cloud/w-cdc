import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignSupplementaryComparison, createAgentPlan, extendAgentPlan, missingPlanData, missingPlanTools, needsRecordId, supplementForExceedance, type AgentTool } from '../src/lib/water-assistant/workflow';

const selected = (question: string, output: string | null) => createAgentPlan(question, output).steps.flatMap(step => step.tool ? [step.tool] : []);

test('every question gets a plan; a greeting can be answered without reading monitoring data', () => {
  const plan = createAgentPlan('你好，小水滴', '{"tools":[]}');
  assert.equal(plan.source, 'model');
  assert.deepEqual(plan.steps.map(step => step.id), ['answer']);
  assert.deepEqual(missingPlanTools(plan, new Set<AgentTool>()), []);
});

test('a verified standard question requires the curated knowledge tool even when the planner omits it', () => {
  assert.deepEqual(selected('GB/T 14848 标准适用于排污口吗？', '{"tools":[]}'), ['search_knowledge']);
});

test('a mixed question must complete monitoring, current approval and knowledge tasks', () => {
  const question = '本企业近7天有异常数据吗？我的审批阈值是什么？GB/T 14848 的依据是什么？';
  const plan = createAgentPlan(question, '{"tools":["analyze_water"]}');
  assert.deepEqual(plan.steps.flatMap(step => step.tool ? [step.tool] : []), [
    'inspect_monitoring_context', 'analyze_water', 'search_knowledge',
  ]);
  assert.deepEqual(missingPlanTools(plan, new Set<AgentTool>(['analyze_water'])), [
    'inspect_monitoring_context', 'search_knowledge',
  ]);
  assert.deepEqual(missingPlanData(plan, new Set(['analyze_water'])), ['inspect_monitoring_context']);
});

test('definition plus a real historical comparison keeps both the data and knowledge tasks', () => {
  assert.deepEqual(selected('什么是 CDC？本企业近7天和历史正常时期有什么变化？', '{"tools":["search_knowledge"]}'), [
    'compare_history', 'search_knowledge',
  ]);
});

test('invalid or invented tools fall back to a bounded plan; no-data is not treated as evidence', () => {
  const plan = createAgentPlan('本企业近7天有异常吗？', '{"tools":["run_sql"]}');
  assert.equal(plan.source, 'fallback');
  assert.deepEqual(missingPlanTools(plan, new Set<AgentTool>()), ['analyze_water']);
  assert.deepEqual(missingPlanData(plan, new Set()), ['analyze_water']);
  assert.deepEqual(missingPlanData(plan, new Set(['analyze_water'])), []);
  assert.deepEqual(selected('如何上传监测数据？', null), ['search_knowledge']);
});

test('planner may add complementary tools to a follow-up but cannot expand the allowed set', () => {
  assert.deepEqual(selected('那这些异常该如何核查？', '{"tools":["compare_history","search_knowledge"]}'), [
    'compare_history', 'search_knowledge',
  ]);
});

test('an ambiguous raw-record request asks for an ID; an explicit or earlier user ID allows a lookup', () => {
  const plan = createAgentPlan('请分析这条记录', '{"tools":["inspect_record_evidence"]}');
  const id = 'c856b13d-3d35-42bf-a679-4489a3eed655';
  assert.equal(needsRecordId(plan, ['请分析这条记录']), true);
  assert.equal(needsRecordId(plan, [`请分析记录ID ${id}`]), false);
  assert.equal(needsRecordId(plan, [`记录ID ${id}`, '再核查这条记录']), false);
  assert.deepEqual(selected(id, '{"tools":[]}'), ['inspect_record_evidence']);
  assert.equal(needsRecordId(createAgentPlan('近7天异常吗？', '{"tools":[]}'), ['近7天异常吗？']), false);
});

test('an observed exceedance adds a visible bounded historical check without making current facts depend on a baseline', () => {
  const initial = createAgentPlan('本企业近7天有异常吗？', '{"tools":["analyze_water"]}');
  const revised = supplementForExceedance(initial, '本企业近7天有异常吗？', true);
  assert.equal(revised.revision, 1);
  assert.deepEqual(revised.steps.map(step => step.id), ['analyze_water', 'compare_history', 'answer']);
  assert.equal(revised.steps[1].required, false);
  assert.match(revised.steps[1].reason ?? '', /超阈值/);
  assert.deepEqual(missingPlanTools(revised, new Set(['analyze_water'])), ['compare_history']);
  assert.deepEqual(missingPlanTools(revised, new Set(['analyze_water']), new Set(['compare_history'])), []);
  assert.deepEqual(missingPlanData(revised, new Set(['analyze_water'])), []);
  assert.equal(supplementForExceedance(revised, '本企业近7天有异常吗？', true), revised);
  assert.equal(supplementForExceedance(initial, '本企业近7天有异常吗？', false), initial);
});

test('spontaneous tool decisions revise the displayed plan once while explicit required checks remain mandatory', () => {
  const initial = createAgentPlan('我的审批阈值是什么？', '{"tools":[]}');
  const revised = extendAgentPlan(initial, 'search_knowledge', '根据已查结果补充核查');
  assert.equal(revised.revision, 1);
  assert.deepEqual(missingPlanTools(revised, new Set(), new Set(['search_knowledge'])), ['inspect_monitoring_context']);
  assert.deepEqual(missingPlanData(revised, new Set()), ['inspect_monitoring_context']);
  assert.equal(extendAgentPlan(revised, 'search_knowledge', '重复'), revised);
});

test('supplementary comparison uses the exact alert period and enterprise, not a different default week', () => {
  assert.deepEqual(alignSupplementaryComparison({ companyName: '乙企业', baselineStartDate: '2026-09-01', baselineEndDate: '2026-09-28' },
    { startDate: '2026-10-01', endDate: '2026-10-07', companyName: '甲企业' }), {
    companyName: '甲企业', currentStartDate: '2026-10-01', currentEndDate: '2026-10-07', baselineStartDate: undefined, baselineEndDate: undefined,
  });
});
