export type EvidenceTool = 'analyze_water' | 'compare_history' | 'inspect_monitoring_context' | 'inspect_record_evidence';

/** Only require a tool for high-confidence data questions; conceptual questions stay conversational. */
export function requiredEvidenceTool(question: string): EvidenceTool | null {
  const q = question.trim();
  const isDefinition = /(什么是|是什么意思|定义|如何计算|计算公式|算法原理)/.test(q);
  if (!isDefinition && /(以前|过去|历史|对比|变化|波动|稳定|升高|下降|趋势|cdc|skew|\bav\b|\bad\b|\bcv\b)/i.test(q)) return 'compare_history';
  if (/(原始记录|记录(?:编号|id)|这条记录|核对记录)/i.test(q)) return 'inspect_record_evidence';
  const entity = /(我(?:的|们)|本企业|所属园区|园区|[\u3400-\u9fff]{2,}企业)/.test(q);
  const period = /(今天|昨日|昨天|本周|上周|本月|最近|近[0-9一二三四五六七八九十]+天|20\d\d-\d\d-\d\d)/.test(q);
  if (entity && /(审批|许可|排污口|污染物|阈值)/.test(q) && !period && !/(监测记录|异常数据|排污情况)/.test(q)) return 'inspect_monitoring_context';
  if (period && /(水质|监测|排污|污染物|数据|记录|异常|超阈值)/.test(q)) return 'analyze_water';
  if (entity && /(监测记录|排污情况|异常数据|超阈值|超上限)/.test(q)) return 'analyze_water';
  return null;
}

export function hasRequiredEvidence(required: EvidenceTool | null, used: ReadonlySet<EvidenceTool>) {
  return required === null || used.has(required) || (required === 'analyze_water' && used.has('compare_history'));
}
