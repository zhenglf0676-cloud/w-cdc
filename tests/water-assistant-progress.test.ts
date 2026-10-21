import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAssistantStream, type AssistantStreamEvent, type ProgressStep } from '../src/lib/water-assistant/progress';
import type { AgentPlan } from '../src/lib/water-assistant/workflow';

function event(value: AssistantStreamEvent) { return `data: ${JSON.stringify(value)}\n\n`; }

test('progress and result arrive in order when events and Chinese UTF-8 split across chunks', async () => {
  const steps: ProgressStep[] = [];
  const plans: AgentPlan[] = [];
  const plan: AgentPlan = { source: 'model', steps: [
    { id: 'analyze_water', label: '统计监测记录', tool: 'analyze_water' },
    { id: 'answer', label: '核对结果并组织回答', tool: null },
  ] };
  const revised: AgentPlan = { ...plan, revision: 1, steps: [plan.steps[0],
    { id: 'compare_history', label: '比较当前与历史', tool: 'compare_history', required: false, reason: '发现超阈值记录，补查历史参照' },
    plan.steps[1],
  ] };
  const bytes = new TextEncoder().encode([
    event({ type: 'progress', step: { id: 'scope', label: '核对可访问企业', state: 'running' } }),
    event({ type: 'plan', plan }),
    event({ type: 'plan', plan: revised }),
    event({ type: 'progress', step: { id: 'scope', label: '核对可访问企业', state: 'done' } }),
    event({ type: 'result', data: { answer: '【结论】有记录', evidence: [], sources: [], toolTrace: [], scope: '本企业', plan: revised } }),
  ].join(''));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
      controller.close();
    },
  });
  const result = await readAssistantStream(new Response(stream), step => steps.push(step), undefined, value => plans.push(value));
  assert.equal(result.answer, '【结论】有记录');
  assert.deepEqual(plans, [plan, revised]);
  assert.deepEqual(result.plan, revised);
  assert.deepEqual(steps.map(step => step.state), ['running', 'done']);
});

test('server error and incomplete streams do not appear as successful answers', async () => {
  const failed = new Response(event({ type: 'error', error: '分析暂未完成' }));
  await assert.rejects(() => readAssistantStream(failed, () => {}), /分析暂未完成/);
  const incomplete = new Response(event({ type: 'progress', step: { id: 'scope', label: '核对可访问企业', state: 'done' } }));
  await assert.rejects(() => readAssistantStream(incomplete, () => {}), /连接提前结束/);
});
