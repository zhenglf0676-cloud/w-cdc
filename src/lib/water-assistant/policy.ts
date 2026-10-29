export type EvidenceTool = 'analyze_water' | 'compare_history' | 'inspect_monitoring_context' | 'inspect_record_evidence';

/** Require every clearly requested data source; the model may add other tools to its plan. */
export function requiredEvidenceTools(question: string): EvidenceTool[] {
  const q = question.trim();
  const isDefinition = /(什么是|是什么意思|定义|如何计算|计算公式|算法原理)/.test(q) &&
    !/(本企业|我的|我们|所属园区|近[0-9一二三四五六七八九十]+天|最近|今天|历史(?:数据|记录|时期)|20\d\d-\d\d-\d\d)/.test(q);
  const required: EvidenceTool[] = [];
  const history = !isDefinition && /(以前|过去|历史|对比|变化|波动|稳定|升高|下降|趋势|cdc|skew|\bav\b|\bad\b|\bcv\b)/i.test(q);
  if (history) required.push('compare_history');
  if (/(原始记录|记录(?:编号|id)|这条记录|核对记录)/i.test(q) || /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(q)) required.push('inspect_record_evidence');
  const entity = /(我(?:的|们)|本企业|所属园区|园区|[\u3400-\u9fff]{2,}企业)/.test(q);
  const period = /(今天|昨日|昨天|本周|上周|本月|最近|近[0-9一二三四五六七八九十]+天|20\d\d-\d\d-\d\d)/.test(q);
  const context = entity && /(审批|许可|排污口|阈值)/.test(q) &&
    ((/(有哪些|是什么|多少|配置|清单|列出|查看|当前|现行)/.test(q) && /(审批|许可|排污口|阈值)/.test(q)) ||
      (!period && !/(监测记录|异常数据|排污情况|超上限|超阈值)/.test(q)));
  if (context) required.push('inspect_monitoring_context');
  const monitoring = (period && /(水质|监测|排污|污染物|数据|记录|异常|超阈值)/.test(q)) ||
    (entity && /(监测记录|排污情况|异常数据|超阈值|超上限)/.test(q));
  if (monitoring && !history && !isDefinition) required.push('analyze_water');
  return required;
}

/** Legacy single-task view, retained for callers that only need the primary data category. */
export function requiredEvidenceTool(question: string): EvidenceTool | null {
  return requiredEvidenceTools(question)[0] ?? null;
}

export function hasRequiredEvidence(required: EvidenceTool | null, used: ReadonlySet<EvidenceTool>) {
  return required === null || used.has(required) || (required === 'analyze_water' && used.has('compare_history'));
}
