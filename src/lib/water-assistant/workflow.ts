import { z } from 'zod';
import { requiredEvidenceTools, type EvidenceTool } from './policy';

export const agentTools = ['analyze_water', 'compare_history', 'inspect_monitoring_context', 'inspect_record_evidence', 'search_knowledge'] as const;
export type AgentTool = typeof agentTools[number];
export type AgentPlanStep = { id: string; label: string; tool: AgentTool | null; required?: boolean; reason?: string };
export type AgentPlan = { steps: AgentPlanStep[]; source: 'model' | 'fallback'; revision?: number };

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

/** A supplementary check is attempted once; failed enrichment cannot erase an established result. */
export function missingPlanTools(plan: AgentPlan, completed: ReadonlySet<AgentTool>, attempted: ReadonlySet<AgentTool> = new Set()): AgentTool[] {
  return plan.steps.flatMap(step => step.tool && !completed.has(step.tool) && (step.required !== false || !attempted.has(step.tool)) ? [step.tool] : []);
}

/** Completion of a tool is not the same as finding enough data for a factual conclusion. */
export function missingPlanData(plan: AgentPlan, available: ReadonlySet<EvidenceTool>): EvidenceTool[] {
  return plan.steps.flatMap(step => {
    if (!step.tool || step.tool === 'search_knowledge' || step.required === false) return [];
    return available.has(step.tool) || (step.tool === 'analyze_water' && available.has('compare_history')) ? [] : [step.tool];
  });
}

/** Show an actual revised plan whenever the agent selects an additional tool. */
export function extendAgentPlan(plan: AgentPlan, tool: AgentTool, reason: string): AgentPlan {
  if (plan.steps.some(step => step.tool === tool)) return plan;
  const answer = plan.steps.at(-1)!;
  return {
    ...plan, revision: (plan.revision ?? 0) + 1,
    steps: [...plan.steps.slice(0, -1), { id: tool, label: toolLabels[tool], tool, required: false, reason }, answer],
  };
}

/** Only a concrete record identifier can be used to inspect one raw reading. */
export function needsRecordId(plan: AgentPlan, userMessages: readonly string[]): boolean {
  if (!plan.steps.some(step => step.tool === 'inspect_record_evidence')) return false;
  const context = userMessages.slice(-4).join(' ');
  return !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(context) &&
    !/记录(?:编号|id)\s*[:：#]?\s*[a-z0-9_-]{4,36}\b/i.test(context);
}

/** An observed exceedance can warrant a historical check, without making it a required fact. */
export function supplementForExceedance(plan: AgentPlan, question: string, foundExceedance: boolean): AgentPlan {
  return foundExceedance && /(分析|异常|风险|变化|波动|原因|为什么|情况)/.test(question)
    ? extendAgentPlan(plan, 'compare_history', '发现超阈值记录，补查历史参照') : plan;
}

/** Keep a supplementary baseline anchored to the period and enterprise that produced the alert. */
export function alignSupplementaryComparison<T extends { currentStartDate?: string; currentEndDate?: string; baselineStartDate?: string; baselineEndDate?: string; companyName?: string }>(
  args: T, analyzed: { startDate: string; endDate: string; companyName?: string },
): T {
  return { ...args, currentStartDate: analyzed.startDate, currentEndDate: analyzed.endDate,
    baselineStartDate: undefined, baselineEndDate: undefined, companyName: analyzed.companyName ?? args.companyName };
}
