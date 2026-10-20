import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAssistantStream, type AssistantStreamEvent, type ProgressStep } from '../src/lib/water-assistant/progress';

function event(value: AssistantStreamEvent) { return `data: ${JSON.stringify(value)}\n\n`; }

test('progress and result arrive in order when events and Chinese UTF-8 split across chunks', async () => {
  const steps: ProgressStep[] = [];
  const bytes = new TextEncoder().encode([
    event({ type: 'progress', step: { id: 'scope', label: '核对可访问企业', state: 'running' } }),
    event({ type: 'progress', step: { id: 'scope', label: '核对可访问企业', state: 'done' } }),
    event({ type: 'result', data: { answer: '【结论】有记录', evidence: [], sources: [], toolTrace: [], scope: '本企业' } }),
  ].join(''));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
      controller.close();
    },
  });
  const result = await readAssistantStream(new Response(stream), step => steps.push(step));
  assert.equal(result.answer, '【结论】有记录');
  assert.deepEqual(steps.map(step => step.state), ['running', 'done']);
});

test('server error and incomplete streams do not appear as successful answers', async () => {
  const failed = new Response(event({ type: 'error', error: '分析暂未完成' }));
  await assert.rejects(() => readAssistantStream(failed, () => {}), /分析暂未完成/);
  const incomplete = new Response(event({ type: 'progress', step: { id: 'scope', label: '核对可访问企业', state: 'done' } }));
  await assert.rejects(() => readAssistantStream(incomplete, () => {}), /连接提前结束/);
});
