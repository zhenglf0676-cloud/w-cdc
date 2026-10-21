import type { KnowledgeSource } from './knowledge';
import type { AgentPlan, AgentTool } from './workflow';

export type ProgressStep = {
  id: string;
  label: string;
  state: 'running' | 'done' | 'failed';
  tool?: AgentTool;
};

export type AssistantResult = {
  answer: string;
  evidence: unknown[];
  sources: KnowledgeSource[];
  toolTrace: unknown;
  scope: string;
  plan?: AgentPlan;
  outcome?: 'complete' | 'partial' | 'needs_input';
};

export type AssistantStreamEvent =
  | { type: 'progress'; step: ProgressStep }
  | { type: 'plan'; plan: AgentPlan }
  | { type: 'result'; data: AssistantResult }
  | { type: 'error'; error: string };

/** Decode POST response events even when UTF-8 characters or event boundaries split across chunks. */
export async function readAssistantStream(
  response: Response,
  onProgress: (step: ProgressStep) => void,
  signal?: AbortSignal,
  onPlan?: (plan: AgentPlan) => void,
): Promise<AssistantResult> {
  if (!response.body) throw new Error('服务器没有返回分析结果，请重试');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let result: AssistantResult | undefined;
  try {
    while (true) {
      signal?.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true });
      if (pending.length > 1024 * 1024) throw new Error('分析结果过长，请缩小查询范围');
      let boundary = pending.indexOf('\n\n');
      while (boundary !== -1) {
        const block = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        for (const line of block.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6)) as AssistantStreamEvent;
          if (event.type === 'progress') onProgress(event.step);
          else if (event.type === 'plan') onPlan?.(event.plan);
          else if (event.type === 'result') result = event.data;
          else if (event.type === 'error') throw new Error(event.error);
        }
        boundary = pending.indexOf('\n\n');
      }
    }
    signal?.throwIfAborted();
    if (!result?.answer) throw new Error('连接提前结束，请重试');
    return result;
  } finally {
    reader.releaseLock();
  }
}
