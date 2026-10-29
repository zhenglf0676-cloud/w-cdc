'use client';

import { z } from 'zod';

const traceSchema = z.array(z.object({ name: z.string(), status: z.enum(['已核查', '未完成']) }));
const contextSchema = z.object({ context: z.literal(true), results: z.array(z.object({
  company: z.string(), approvedOutlets: z.array(z.object({ id: z.string(), name: z.string() })),
  approvedPollutants: z.array(z.object({ id: z.string(), label: z.string(), unit: z.string().nullable(), threshold: z.number().nullable(), approvedAt: z.string().nullable() })),
})) });
const recordSchema = z.object({ recordEvidence: z.literal(true), records: z.array(z.object({
  id: z.string(), company: z.string(), outlet: z.string(), pollutant: z.string(), value: z.number(), unit: z.string().nullable(),
  recordThreshold: z.number().nullable(), timeBeijing: z.string(), beyondStoredUpperLimit: z.boolean().nullable(),
})), notReturned: z.number() });
const names: Record<string, string> = {
  analyze_water: '监测统计', compare_history: '历史对比', inspect_monitoring_context: '审批配置',
  inspect_record_evidence: '原始记录', search_knowledge: '资料检索',
};

export function ToolEvidence({ evidence, trace }: { evidence?: unknown[]; trace?: unknown }) {
  const calls = traceSchema.safeParse(trace);
  const contexts = (evidence ?? []).flatMap(item => { const parsed = contextSchema.safeParse(item); return parsed.success ? [parsed.data] : []; });
  const records = (evidence ?? []).flatMap(item => { const parsed = recordSchema.safeParse(item); return parsed.success ? [parsed.data] : []; });
  if (!calls.success && !contexts.length && !records.length) return null;
  return <div className="mt-3 space-y-3 border-t border-teal-100 pt-3 text-xs" aria-label="工具调用与核查证据">
    {calls.success && !!calls.data.length && <div className="flex flex-wrap gap-1.5"><span className="self-center font-semibold text-teal-900">核查步骤</span>
      {calls.data.map((item, i) => <span key={`${item.name}-${i}`} className={`rounded-full border px-2 py-0.5 ${item.status === '已核查' ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{names[item.name] ?? item.name} · {item.status}</span>)}
    </div>}
    {contexts.map((context, i) => <div key={i} className="space-y-2 rounded-xl border border-teal-100 bg-white p-3">
      <p className="font-semibold text-teal-900">已授权企业 · 当前审批配置</p>
      {context.results.map(company => <div key={company.company} className="space-y-1 border-t border-slate-100 pt-2 text-slate-700">
        <p className="font-medium">{company.company} · {company.approvedOutlets.length} 个已审批排污口</p>
        <p>排污口：{company.approvedOutlets.map(outlet => outlet.name).join('、') || '暂无'}</p>
        <p>企业已审批指标：{company.approvedPollutants.map(item => `${item.label} ${item.threshold ?? '缺上限'}${item.unit ?? ''}`).join('；') || '暂无'}</p>
      </div>)}
      {!context.results.length && <p className="text-slate-600">指定企业不在授权范围内，或没有匹配结果。</p>}
      <p className="text-slate-500">污染物审批配置按企业存储，不代表每个排污口分别审批；当前上限不等于法定排放限值。</p>
    </div>)}
    {records.map((report, i) => <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-700">
      <p className="font-semibold text-teal-900">原始记录核查 · {report.records.length} 条可访问</p>
      {report.records.map(record => <p key={record.id} className="mt-1 border-t border-slate-100 pt-1">{record.id} · {record.company} / {record.outlet} · {record.pollutant} <strong>{record.value} {record.unit ?? ''}</strong> · {record.timeBeijing}（北京时间） · 保存上限 {record.recordThreshold ?? '缺失'}{record.beyondStoredUpperLimit === null ? ' · 暂不能判定' : record.beyondStoredUpperLimit ? ' · 高于保存上限' : ' · 未高于保存上限'}</p>)}
      {report.notReturned > 0 && <p className="mt-2 text-amber-700">{report.notReturned} 个 ID 未返回：可能不存在或不在授权范围内。</p>}
    </div>)}
  </div>;
}
