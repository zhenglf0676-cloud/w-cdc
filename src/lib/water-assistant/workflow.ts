import { z } from 'zod';
import { requiredEvidenceTools, type EvidenceTool } from './policy';

export const agentTools = ['analyze_water', 'compare_history', 'inspect_monitoring_context', 'inspect_record_evidence', 'search_knowledge'] as const;
export type AgentTool = typeof agentTools[number];
export type AgentPlanStep = { id: string; label: string; tool: AgentTool | null };
export type AgentPlan = { steps: AgentPlanStep[]; source: 'model' | 'fallback' };

export const toolLabels: Record<AgentTool, string> = {
  analyze_water: '统计监测记录', compare_history: '比较当前与历史',
  inspect_monitoring_context: '核对审批配置', inspect_record_evidence: '核对原始记录',
  search_knowledge: '检索资料依据',
};

const modelPlan = z.object({ tools: z.array(z.enum(agentTools)).max(5) }).strict();

/** The planner selects useful tools; explicit data requests still have a server-side floor. */
export function createAgentPlan(question: string, modelOutput: string | null): AgentPlan {
  let selected: AgentTool[] = [];
  let source: AgentPlan['source'] = 'fallback';
  try {
    const parsed = modelPlan.parse(JSON.parse((modelOutput ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')));
    selected = parsed.tools;
    source = 'model';
  } catch {
    // A malformed plan cannot bypass server-required data or knowledge checks.
  }
  const required = requiredEvidenceTools(question);
  const tools = [...new Set<AgentTool>([...required, ...selected, ...(needsVerifiedKnowledge(question) || (source === 'fallback' && likelyKnowledgeQuestion(question)) ? ['search_knowledge' as const] : [])])];
  return {
    source,
    steps: [...tools.map(tool => ({ id: tool, label: toolLabels[tool], tool })),
      { id: 'answer', label: tools.length ? '核对结果并组织回答' : '理解问题并直接回答', tool: null }],
  };
}

export function likelyKnowledgeQuestion(question: string): boolean {
  return /(什么|如何|怎么|标准|规范|依据|说明|解释|算法|含义|阈值|超标|质控|采样|上传|录入|cdc|skew|\bav\b|\bad\b|\bcv\b|pH)/i.test(question);
}

function needsVerifiedKnowledge(question: string): boolean {
  return /(标准|规范|依据|算法|公式|质控|采样|如何上传|怎么上传|如何录入|怎么录入|GB\/?T\s*\d|HJ\s*\d)/i.test(question);
}

export function missingPlanTools(plan: AgentPlan, completed: ReadonlySet<AgentTool>): AgentTool[] {
  return plan.steps.flatMap(step => step.tool && !completed.has(step.tool) ? [step.tool] : []);
}

/** Completion of a tool is not the same as finding enough data for a factual conclusion. */
export function missingPlanData(plan: AgentPlan, available: ReadonlySet<EvidenceTool>): EvidenceTool[] {
  return plan.steps.flatMap(step => {
    if (!step.tool || step.tool === 'search_knowledge') return [];
    return available.has(step.tool) || (step.tool === 'analyze_water' && available.has('compare_history')) ? [] : [step.tool];
  });
}
