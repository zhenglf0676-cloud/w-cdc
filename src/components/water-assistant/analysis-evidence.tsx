'use client';

import dynamic from 'next/dynamic';
import { z } from 'zod';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });
const palette = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];
const summary = z.object({
  outlet: z.string().optional(), pollutant: z.string(), unit: z.string().nullable(),
  count: z.number(), exceedances: z.number(), missingThreshold: z.number(),
  approvedName: z.string().nullable().optional(), currentThreshold: z.number().nullable().optional(),
  recordThresholds: z.array(z.number().nullable()).optional(), thresholdChanged: z.boolean().optional(),
  approvalStatus: z.string().optional(),
  daily: z.array(z.object({ date: z.string(), mean: z.number(), count: z.number(), exceedances: z.number() })),
});
const result = z.object({ company: z.string(), approvedOutlets: z.array(z.object({ id: z.string(), name: z.string() })).optional(), summaries: z.array(summary) });
const evidenceSchema = z.object({ startDate: z.string(), endDate: z.string(), results: z.array(result) });

export function AnalysisEvidence({ evidence, admin }: { evidence?: unknown[]; admin: boolean }) {
  const analyses = (evidence ?? []).flatMap(item => {
    const parsed = evidenceSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  if (!analyses.length) return null;
  return <div className="mt-3 space-y-3 border-t border-teal-100 pt-3">
    {analyses.map((analysis, index) => {
      const rows = analysis.results.flatMap(company => company.summaries.map(s => ({ ...s, company: company.company })));
      const groups = [...new Set(rows.map(r => r.unit ?? '未标单位'))].slice(0, 3);
      return <section key={`${analysis.startDate}-${analysis.endDate}-${index}`} className="space-y-2" aria-label="监测分析图表">
        <p className="text-xs font-medium text-teal-800">{analysis.startDate} 至 {analysis.endDate} · 监测趋势</p>
        {admin && <div className="space-y-1 rounded-xl border border-teal-100 bg-white p-2" aria-label="所属园区企业统计">
          <p className="text-xs font-medium text-teal-800">所属园区企业概览 · 按超审批上限次数排序</p>
          {[...analysis.results].sort((a, b) => b.summaries.reduce((sum, s) => sum + s.exceedances, 0) - a.summaries.reduce((sum, s) => sum + s.exceedances, 0)).slice(0, 8).map(company => <div key={company.company} className="flex flex-wrap justify-between gap-1 border-t border-slate-100 py-1 text-xs text-slate-600"><span className="font-medium text-slate-700">{company.company}</span><span>{company.approvedOutlets?.length ?? 0} 个已审批排污口 · {company.summaries.reduce((sum, s) => sum + s.count, 0)} 条记录 · <strong className="text-amber-700">{company.summaries.reduce((sum, s) => sum + s.exceedances, 0)} 条超上限</strong></span></div>)}
          {analysis.results.length > 8 && <p className="text-xs text-slate-500">这里只展示前 8 家；完整企业结果见下方证据。</p>}
          <p className="text-xs text-slate-500">此排序是记录次数排序，不是 CDC 风险排行；记录量不同的企业不可仅凭次数比较污染程度。</p>
        </div>}
        {rows.length ? <>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-lg bg-white px-2 py-1">{rows.reduce((sum, r) => sum + r.count, 0)} 条记录</span>
            <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-800">{rows.reduce((sum, r) => sum + r.exceedances, 0)} 条超审批上限</span>
            {!!rows.some(r => r.missingThreshold) && <span className="rounded-lg bg-slate-100 px-2 py-1">{rows.reduce((sum, r) => sum + r.missingThreshold, 0)} 条缺上限</span>}
          </div>
          {groups.map(unit => {
            const selected = rows.filter(row => (row.unit ?? '未标单位') === unit);
            const visible = selected.slice(0, 5);
            const dates = [...new Set(visible.flatMap(row => row.daily.map(day => day.date)))].sort();
            if (!dates.length) return null;
            if (dates.length === 1) return <div key={unit} className="rounded-xl border border-slate-200 bg-white p-3 text-xs" aria-label="单日监测摘要">
              <p className="font-semibold text-slate-700">{dates[0]} · {unit} 单日摘要</p>
              <div className="mt-2 space-y-1.5">{visible.map((row, i) => <div key={`${row.company}-${row.outlet}-${row.pollutant}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-1.5 text-slate-600">
                <span className="font-medium text-slate-800">{row.outlet ?? row.company} · {row.approvedName ?? row.pollutant}</span>
                <span>当日均值 {Number(row.daily[0].mean.toFixed(3))} {unit === '未标单位' ? '' : unit} · <strong className={row.exceedances ? 'text-amber-800' : 'font-normal'}>{row.exceedances} 条超审批上限</strong></span>
              </div>)}</div>
              {selected.length > visible.length && <p className="mt-2 text-slate-500">这里只显示前 {visible.length} 项，其他结果见下方证据。</p>}
            </div>;
            const option = {
              color: palette,
              tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
              legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 10 } },
              grid: { left: '3%', right: '5%', top: '7%', bottom: 48, containLabel: true },
              xAxis: { type: 'category', boundaryGap: false, data: dates.map(date => date.slice(5)) },
              yAxis: { type: 'value', name: unit === '未标单位' ? '数值' : unit, nameTextStyle: { fontSize: 10 } },
              series: visible.map((row, i) => ({
                name: `${row.company} · ${row.outlet ?? '排污口'} · ${row.pollutant}`,
                type: 'line', smooth: true, symbol: 'circle', symbolSize: 5,
                lineStyle: { width: 2 }, itemStyle: { color: palette[i % palette.length] },
                data: dates.map(date => row.daily.find(day => day.date === date)?.mean ?? null),
              })),
            };
            return <div key={unit} className="rounded-xl border border-slate-200 bg-white p-2">
              <p className="px-1 text-xs font-medium text-slate-700">按日均值 · {unit}</p>
              <ReactECharts option={option} style={{ height: 240 }} notMerge lazyUpdate />
              {selected.length > visible.length && <p className="px-1 text-xs text-slate-500">图中显示前 {visible.length} 条序列，其余记录见下方证据。</p>}
            </div>;
          })}
          {rows.some(row => row.daily.length) && <p className="text-xs text-slate-500">北京时间逐日平均值；超阈值次数按单条记录与审批上限比较。图中日均值不用于法定达标判定。</p>}
          <details className="rounded-xl border border-slate-200 bg-white p-2 text-xs"><summary className="cursor-pointer font-medium text-teal-800">按企业 / 排污口 / 污染物查看阈值与记录</summary>
            <div className="mt-2 space-y-1">{rows.slice(0, 30).map((row, i) => <p key={`${row.company}-${row.outlet}-${row.pollutant}-${i}`} className="border-t border-slate-100 py-1 text-slate-600"><span className="font-medium text-slate-800">{row.company} · {row.outlet ?? '排污口'} · {row.approvedName ?? row.pollutant}</span>：{row.count} 条，{row.exceedances} 条超记录上限；当前审批上限 {row.currentThreshold === null || row.currentThreshold === undefined ? '未匹配' : `${row.currentThreshold} ${row.unit ?? ''}`}；记录保存上限 {row.recordThresholds?.map(value => value ?? '缺失').join('、') || '未提供'} {row.unit ?? ''}{row.thresholdChanged ? '（与当前审批不同，请复核）' : ''}{row.approvalStatus !== '已匹配当前审批配置' && row.approvalStatus ? `；${row.approvalStatus}` : ''}</p>)}{rows.length > 30 && <p className="text-slate-500">仅列前 30 项，完整结果见下方证据。</p>}</div>
          </details>
          {groups.length < new Set(rows.map(row => row.unit ?? '未标单位')).size && <p className="text-xs text-slate-500">图表仅显示前三种单位，完整数据见下方证据。</p>}
        </> : <p className="text-xs text-slate-500">该时段没有可展示的监测记录；请核查数据上报状态。</p>}
      </section>;
    })}
    <details className="text-xs"><summary className="cursor-pointer font-medium text-teal-700">查看完整计算结果与记录证据</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white p-2 text-slate-600">{JSON.stringify(evidence, null, 2)}</pre></details>
  </div>;
}
