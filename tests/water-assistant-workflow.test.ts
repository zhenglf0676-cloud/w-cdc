import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAgentPlan, missingPlanData, missingPlanTools, type AgentTool } from '../src/lib/water-assistant/workflow';

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
