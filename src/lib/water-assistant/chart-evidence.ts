import { z } from 'zod';
import type { EChartsOption } from 'echarts';
import type { DownloadChart } from './chart-export';

const summary = z.object({
  outlet: z.string().optional(), pollutant: z.string(), unit: z.string().nullable(),
  count: z.number(), exceedances: z.number(), missingThreshold: z.number(), unassessable: z.number().optional(),
  approvedName: z.string().nullable().optional(), currentThreshold: z.number().nullable().optional(),
  recordThresholds: z.array(z.number().nullable()).optional(), thresholdChanged: z.boolean().optional(),
  approvalStatus: z.string().optional(),
  daily: z.array(z.object({ date: z.string(), mean: z.number(), count: z.number(), exceedances: z.number() })),
});
const result = z.object({ company: z.string(), approvedOutlets: z.array(z.object({ id: z.string(), name: z.string() })).optional(), summaries: z.array(summary) });
export const analysisEvidenceSchema = z.object({ startDate: z.string(), endDate: z.string(), results: z.array(result) });

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
export const historyEvidenceSchema = z.object({
  comparison: z.literal(true), current: z.object({ startDate: z.string(), endDate: z.string() }),
  baseline: z.object({ startDate: z.string(), endDate: z.string() }), totalCompanies: z.number(), note: z.string(),
  results: z.array(z.object({ company: z.string(), currentCDC: z.number().nullable(), previousCDC: z.number().nullable(), currentRecords: z.number(), previousRecords: z.number(), currentExceedances: z.number(), previousExceedances: z.number(), pollutants: z.array(metric) })),
});
export type HistoryMetricData = z.infer<typeof metric>;
export type AnalysisData = z.infer<typeof analysisEvidenceSchema>;
export type AnalysisRow = AnalysisData['results'][number]['summaries'][number] & { company: string };

const palette = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];

export function analysisChartOption(rows: AnalysisRow[], dates: string[], unit: string, fullDates = false): EChartsOption {
  return {
    color: palette,
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 10 } },
    grid: { left: '3%', right: '5%', top: '7%', bottom: 48, containLabel: true },
    xAxis: { type: 'category', boundaryGap: dates.length === 1, data: fullDates ? dates : dates.map(date => date.slice(5)) },
    yAxis: { type: 'value', name: unit === '未标单位' ? '数值' : unit, nameTextStyle: { fontSize: 10 } },
    series: rows.map((row, i) => ({
      name: `${row.company} · ${row.outlet ?? '排污口'} · ${row.pollutant}`,
      type: dates.length === 1 ? 'bar' : 'line', smooth: true, symbol: 'circle', symbolSize: 5,
      lineStyle: { width: 2 }, itemStyle: { color: palette[i % palette.length] },
      data: dates.map(date => row.daily.find(day => day.date === date)?.mean ?? null),
    })),
  };
}

export function historyChartOption(item: HistoryMetricData, days: string[], fullDates = false): EChartsOption {
  return {
    color: ['#0ea5e9', '#f59e0b'], tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { bottom: 0, textStyle: { fontSize: 10 } }, grid: { left: '3%', right: '5%', top: '7%', bottom: 38, containLabel: true },
    xAxis: { type: 'category', data: fullDates ? days : days.map(day => day.slice(5)), boundaryGap: false },
    yAxis: { type: 'value', name: item.unit },
    series: [
      { name: '历史参考日汇总', type: 'line', smooth: true, symbolSize: 5, data: days.map(day => item.normalReference.daily.find(p => p.date === day)?.value ?? null) },
      { name: '当前日汇总', type: 'line', smooth: true, symbolSize: 5, data: days.map(day => item.currentDaily.find(p => p.date === day)?.value ?? null) },
    ],
  };
}

/** The same limits, series order and values as the ordinary evidence charts. No model-generated numbers. */
export function chartsFromEvidence(evidence: unknown[] = []): DownloadChart[] {
  return evidence.flatMap((entry, index): DownloadChart[] => {
    const analysis = analysisEvidenceSchema.safeParse(entry);
    if (analysis.success) {
      const { startDate, endDate, results } = analysis.data;
      const rows = results.flatMap(company => company.summaries.map(row => ({ ...row, company: company.company })));
      const allUnits = [...new Set(rows.map(row => row.unit ?? '未标单位'))];
      return allUnits.slice(0, 3).flatMap((unit, group) => {
        const selected = rows.filter(row => (row.unit ?? '未标单位') === unit);
        const visible = selected.slice(0, 5);
        const dates = [...new Set(visible.flatMap(row => row.daily.map(day => day.date)))].sort();
        if (!dates.length) return [];
        return [{
          id: `${startDate}_${endDate}-${index + 1}-${group + 1}`,
          title: `监测日均值 · ${unit}`,
          subtitle: `${startDate} 至 ${endDate}（北京时间） · 小水滴监测分析`,
          footnotes: [
            '来源：本轮已授权监测查询。北京时间逐日平均值；日均值不用于法定达标判定。',
            '超审批上限按单条记录保存的上限比较；超上限不等同法定超标；pH 缺双侧阈值不自动判定。',
            `本图展示 ${visible.length}/${selected.length} 条序列；本次导出 ${Math.min(allUnits.length, 3)}/${allUnits.length} 种单位，其他数据见原回答证据。`,
          ],
          option: analysisChartOption(visible, dates, unit, true),
        }];
      });
    }
    const history = historyEvidenceSchema.safeParse(entry);
    if (!history.success) return [];
    const { current, baseline, results } = history.data;
    return results.flatMap((company, companyIndex) => company.pollutants.slice(0, 5).flatMap((item, pollutantIndex) => {
      const days = [...new Set([...item.normalReference.daily, ...item.currentDaily].map(point => point.date))].sort();
      if (!days.length) return [];
      return [{
        id: `${current.startDate}_${current.endDate}-${index + 1}-${companyIndex + 1}-${pollutantIndex + 1}`,
        title: `${company.company} · ${item.label} · 历史参考与当前期`,
        subtitle: `当前 ${current.startDate} 至 ${current.endDate} · 历史参考 ${baseline.startDate} 至 ${baseline.endDate}（北京时间）`,
        footnotes: [
          '来源：本轮已授权监测查询。企业各排污口当天最新值合计，仅用于平台波动指标，并非单个排污口浓度。',
          item.comparable ? '历史正常参考仅指记录未超审批上限，不证明法定达标；CDC 两期分别归一化，不直接相减判风险。' : '两期样本或单位不满足比较条件，不判断波动方向；仅展示现有数据，缺失不代表正常。',
          `当前有效 ${item.current.positiveDays} 天，历史正常参考 ${item.normalReference.days} 天；本企业展示前 ${Math.min(5, company.pollutants.length)}/${company.pollutants.length} 个指标。`,
        ],
        option: historyChartOption(item, days, true),
      }];
    }));
  });
}
