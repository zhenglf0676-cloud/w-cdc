'use client';

import dynamic from 'next/dynamic';
import { z } from 'zod';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });
const stats = z.object({ av: z.number(), ad: z.number(), cv: z.number(), skew: z.number() }).nullable();
const points = z.array(z.object({ date: z.string(), value: z.number() }));
const metric = z.object({
  pollutant: z.string(), label: z.string(), unit: z.string(), comparable: z.boolean(), note: z.string().nullable(),
  current: z.object({ stats, cdc: z.number().nullable(), records: z.number(), exceedances: z.number(), positiveDays: z.number() }),
  previous: z.object({ stats, cdc: z.number().nullable(), records: z.number() }),
  normalReference: z.object({ days: z.number(), excludedDays: z.number(), stats, daily: points }),
  currentDaily: points,
  change: z.object({ av: z.number(), ad: z.number(), cv: z.number(), skew: z.number(), avPercent: z.number().nullable() }).nullable(),
  outletWarnings: z.array(z.object({ name: z.string(), count: z.number() })),
});
const history = z.object({
  comparison: z.literal(true), current: z.object({ startDate: z.string(), endDate: z.string() }),
  baseline: z.object({ startDate: z.string(), endDate: z.string() }), totalCompanies: z.number(), note: z.string(),
  results: z.array(z.object({ company: z.string(), currentCDC: z.number().nullable(), previousCDC: z.number().nullable(), currentRecords: z.number(), previousRecords: z.number(), currentExceedances: z.number(), previousExceedances: z.number(), pollutants: z.array(metric) })),
});
const fmt = (value: number | null | undefined) => value === null || value === undefined ? '—' : Number(value.toFixed(3)).toString();

export function HistoryEvidence({ evidence }: { evidence?: unknown[] }) {
  const reports = (evidence ?? []).flatMap(item => { const parsed = history.safeParse(item); return parsed.success ? [parsed.data] : []; });
  if (!reports.length) return null;
  return <div className="mt-3 space-y-3 border-t border-teal-100 pt-3" aria-label="历史正常参考与当前期对比">
    {reports.map((report, i) => <section key={i} className="space-y-3">
      <div className="rounded-xl border border-teal-100 bg-white p-3 text-xs text-slate-700">
        <p className="font-medium text-teal-900">当前 {report.current.startDate}—{report.current.endDate}</p>
        <p className="mt-1">历史参考 {report.baseline.startDate}—{report.baseline.endDate} · {report.totalCompanies} 家授权企业</p>
      </div>
      {report.results.map(company => <div key={company.company} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs">
        <p className="font-semibold text-teal-900">{company.company}</p>
        <div className="flex flex-wrap gap-2 text-slate-600"><span>当前 {company.currentRecords} 条 / 超上限 {company.currentExceedances} 条</span><span>历史 {company.previousRecords} 条 / 超上限 {company.previousExceedances} 条</span></div>
        <p className="text-slate-600">页面口径 CDC：当前 {fmt(company.currentCDC)}，历史 {fmt(company.previousCDC)} <span className="text-amber-700">（两期分别归一化，不据此直接判定风险升降）</span></p>
        {company.pollutants.slice(0, 5).map(item => {
          const days = [...new Set([...item.normalReference.daily, ...item.currentDaily].map(point => point.date))].sort();
          const option = { color: ['#0ea5e9', '#f59e0b'], tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
            legend: { bottom: 0, textStyle: { fontSize: 10 } }, grid: { left: '3%', right: '5%', top: '7%', bottom: 38, containLabel: true },
            xAxis: { type: 'category', data: days.map(day => day.slice(5)), boundaryGap: false }, yAxis: { type: 'value', name: item.unit },
            series: [
              { name: '历史参考日汇总', type: 'line', smooth: true, symbolSize: 5, data: days.map(day => item.normalReference.daily.find(p => p.date === day)?.value ?? null) },
              { name: '当前日汇总', type: 'line', smooth: true, symbolSize: 5, data: days.map(day => item.currentDaily.find(p => p.date === day)?.value ?? null) },
            ] };
          return <div key={item.pollutant} className="space-y-1 border-t border-slate-100 pt-2">
            <p className="font-medium text-slate-800">{item.label} · {item.unit}</p>
            <p className="text-slate-600">历史正常参考 {item.normalReference.days} 天；当前有效 {item.current.positiveDays} 天；当前超上限 {item.current.exceedances} 条。</p>
            {item.comparable && item.current.stats && item.normalReference.stats ? <div className="grid grid-cols-2 gap-1 text-slate-600"><span>AV：{fmt(item.normalReference.stats.av)} → {fmt(item.current.stats.av)} {typeof item.change?.avPercent === 'number' ? `(${fmt(item.change.avPercent)}%)` : ''}</span><span>AD：{fmt(item.normalReference.stats.ad)} → {fmt(item.current.stats.ad)}</span><span>CV：{fmt(item.normalReference.stats.cv)} → {fmt(item.current.stats.cv)}</span><span>SKEW：{fmt(item.normalReference.stats.skew)} → {fmt(item.current.stats.skew)}</span></div> : <p className="text-amber-700">{item.note ?? '暂无可比的历史正常参考。'}</p>}
            {!!item.outletWarnings.length && <p className="text-amber-800">异常排污口：{item.outletWarnings.map(o => `${o.name} ${o.count} 条`).join('、')}</p>}
            {!!days.length && <ReactECharts option={option} style={{ height: 205 }} notMerge lazyUpdate />}
            {!!days.length && <p className="text-slate-500">曲线为企业各排污口当天最新值的合计，仅用于平台波动指标计算，并非单个排污口浓度。</p>}
          </div>;
        })}
        {company.pollutants.length > 5 && <p className="text-slate-500">显示前 5 个指标；完整结果见下方证据。</p>}
      </div>)}
      {!report.results.length && <p className="text-xs text-slate-500">未找到授权范围内匹配的企业。</p>}
      <p className="text-xs text-slate-500">{report.note}</p>
    </section>)}
    <details className="text-xs"><summary className="cursor-pointer font-medium text-teal-700">查看两期完整计算证据</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white p-2 text-slate-600">{JSON.stringify(reports, null, 2)}</pre></details>
  </div>;
}
