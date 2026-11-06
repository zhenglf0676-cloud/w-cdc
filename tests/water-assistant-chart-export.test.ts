import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { chartsFromEvidence, analysisChartOption } from '../src/lib/water-assistant/chart-evidence';
import { chartFileName, downloadableOption, reusesPreviousChart, wantsChartDownload } from '../src/lib/water-assistant/chart-export';
import { requiredEvidenceTools } from '../src/lib/water-assistant/policy';
import { createAgentPlan } from '../src/lib/water-assistant/workflow';
import { ChartDownloads } from '../src/components/water-assistant/chart-downloads';

const row = (pollutant = 'nh3', unit = 'mg/L') => ({
  outlet: 'cqust-1', pollutant, unit, count: 3, exceedances: 1, missingThreshold: 0,
  daily: [{ date: '2026-10-20', mean: 0, count: 1, exceedances: 0 }, { date: '2026-10-22', mean: 0.68, count: 2, exceedances: 1 }],
});
const analysis = { startDate: '2026-10-20', endDate: '2026-10-26', results: [{ company: '重庆科技大学', summaries: [row()] }] };
const stats = { av: 0.25, ad: 0.05, cv: 0.2, skew: 1 };
const metric = {
  pollutant: 'nh3', label: '氨氮', unit: 'mg/L', comparable: false, note: '历史参考不足',
  current: { stats, cdc: 1, records: 2, exceedances: 0, positiveDays: 2 },
  previous: { stats: null, cdc: null, records: 0 },
  normalReference: { days: 0, excludedDays: 0, stats: null, daily: [] },
  currentDaily: [{ date: '2026-10-20', value: 0.25 }, { date: '2026-10-21', value: 0.3 }], change: null, outletWarnings: [],
};
const history = {
  comparison: true, current: { startDate: '2026-10-20', endDate: '2026-10-26' }, baseline: { startDate: '2026-09-22', endDate: '2026-10-19' },
  totalCompanies: 1, note: '两期分别归一化', results: [{ company: '重庆科技大学', currentCDC: 1, previousCDC: null, currentRecords: 2, previousRecords: 0, currentExceedances: 0, previousExceedances: 0, pollutants: [metric] }],
};

test('downloads are opt-in and plain references reuse a snapshot without swallowing new questions', () => {
  for (const q of ['把刚才的图导出', '这张图能下载吗', '给我下载上面的趋势图', '保存图表为PNG']) {
    assert.equal(wantsChartDownload(q), true, q);
    assert.equal(reusesPreviousChart(q), true, q);
  }
  for (const q of ['分析近7天的氨氮趋势', '这张图片写了什么', '如何上传Excel', '不要下载图片，只分析']) assert.equal(wantsChartDownload(q), false, q);
  for (const q of ['生成一张可下载的趋势图', '生成2026-10-01至2026-10-07的可下载趋势图', '把刚才图中的COD单独导出', '重新查询近7天并导出图表', '把刚才的图改成柱状图下载']) {
    assert.equal(reusesPreviousChart(q), false, q);
  }
});

test('new downloadable trends require authorized current data, historical comparisons keep the old workflow', () => {
  assert.deepEqual(requiredEvidenceTools('生成2026-10-01至2026-10-07的可下载氨氮趋势图'), ['analyze_water']);
  assert.deepEqual(requiredEvidenceTools('导出本企业当前和历史正常时期的对比图'), ['compare_history']);
  assert.deepEqual(requiredEvidenceTools('本企业最近7天趋势怎么样'), ['compare_history']);
  const plan = createAgentPlan('生成可下载的监测趋势图', '{"tools":[]}');
  assert.ok(plan.steps.some(step => step.tool === 'analyze_water' && step.required !== false));
});

test('downloaded trends use exactly the displayed series, preserve zeros/gaps and full dates', () => {
  const other = { ...row('cod'), daily: [{ date: '2026-10-21', mean: 20, count: 1, exceedances: 0 }] };
  const report = { ...analysis, results: [{ ...analysis.results[0], summaries: [row(), other] }] };
  const [chart] = chartsFromEvidence([report]);
  assert.ok(chart);
  assert.deepEqual(chart.option.series, analysisChartOption(report.results[0].summaries.map(r => ({ ...r, company: '重庆科技大学' })), ['2026-10-20', '2026-10-21', '2026-10-22'], 'mg/L').series);
  assert.ok(Array.isArray(chart.option.series));
  assert.deepEqual(chart.option.series[0].data, [0, null, 0.68]);
  assert.deepEqual(chart.option.series[1].data, [null, 20, null]);
  const exported = downloadableOption(chart);
  assert.deepEqual(exported.series, chart.option.series);
  assert.deepEqual(exported.xAxis, chart.option.xAxis);
  assert.match(JSON.stringify(exported), /2026-10-22/);
  assert.match(JSON.stringify(exported), /不用于法定达标判定/);
  assert.equal(exported.animation, false);
});

test('different units never share an axis; truncation is explicit in the exported image', () => {
  const report = { ...analysis, results: [{ ...analysis.results[0], summaries: [...Array.from({ length: 7 }, (_, i) => ({ ...row(), outlet: `outlet-${i}` })), row('ph', '无量纲')] }] };
  const charts = chartsFromEvidence([report]);
  assert.equal(charts.length, 2);
  assert.ok(Array.isArray(charts[0].option.series));
  assert.equal(charts[0].option.series.length, 5);
  assert.match(charts[0].footnotes.join(), /5\/7 条序列/);
  assert.match(charts[1].title, /无量纲/);
});

test('empty or invalid evidence does not produce fabricated charts; one-day data can be exported', () => {
  assert.deepEqual(chartsFromEvidence([{}, { ...analysis, results: [] }, { ...analysis, results: [{ ...analysis.results[0], summaries: [{ ...row(), daily: [] }] }] }]), []);
  const invalid = { ...analysis, results: [{ ...analysis.results[0], summaries: [{ ...row(), daily: [{ date: '2026-10-20', mean: NaN, count: 1, exceedances: 0 }] }] }] };
  assert.deepEqual(chartsFromEvidence([invalid]), []);
  const single = { ...analysis, results: [{ ...analysis.results[0], summaries: [{ ...row(), daily: row().daily.slice(0, 1) }] }] };
  const [chart] = chartsFromEvidence([single]);
  assert.ok(Array.isArray(chart.option.series));
  assert.equal(chart.option.series[0].type, 'bar');
  assert.deepEqual(chart.option.series[0].data, [0]);
});

test('history exports preserve daily-sum semantics and state a missing baseline', () => {
  const [chart] = chartsFromEvidence([history]);
  assert.match(chart.title, /重庆科技大学.*氨氮/);
  assert.match(chart.subtitle, /2026-09-22.*2026-10-19/);
  assert.match(chart.footnotes.join(), /当天最新值合计/);
  assert.match(chart.footnotes.join(), /不判断波动方向/);
  assert.ok(Array.isArray(chart.option.series));
  assert.deepEqual(chart.option.series[0].data, [null, null]);
  assert.deepEqual(chart.option.series[1].data, [0.25, 0.3]);
});

test('download cards render actionable controls only for validated chart data', () => {
  const html = renderToString(createElement(ChartDownloads, { evidence: [analysis] }));
  assert.match(html, /下载 PNG/);
  assert.match(html, /2026-10-20/);
  assert.match(html, /2400/);
  const empty = renderToString(createElement(ChartDownloads, { evidence: [] }));
  assert.match(empty, /没有可导出/);
  assert.doesNotMatch(empty, /<button/);
  const [chart] = chartsFromEvidence([analysis]);
  assert.ok(chartFileName({ ...chart, title: '企业/图表:一' }).endsWith('.png'));
  assert.doesNotMatch(chartFileName({ ...chart, title: '企业/图表:一' }), /[/:]/);
});
