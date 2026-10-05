import * as echarts from 'echarts';
import sharp from 'sharp';
import type { Analysis, Report } from './model';
async function render(option: echarts.EChartsOption) {
  const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 1000, height: 440 });
  try { chart.setOption({ animation: false, textStyle: { fontFamily: 'sans-serif' }, ...option }); return await sharp(Buffer.from(chart.renderToSVGString())).png().toBuffer(); }
  finally { chart.dispose(); }
}
export async function comparison(report: Report) {
  const companies = [...report.companies].filter(c => c.cdc !== null).sort((a, b) => (b.cdc ?? 0) - (a.cdc ?? 0)).slice(0, 12);
  if (!companies.length) return null;
  return render({ grid: { left: 60, right: 30, top: 25, bottom: 95 }, xAxis: { type: 'category', data: companies.map((_, i) => String(i + 1)), axisLabel: { width: 90, overflow: 'break', interval: 0 } }, yAxis: { type: 'value', name: 'CDC' }, series: [{ type: 'bar', data: companies.map(c => c.cdc), itemStyle: { color: '#16858a' }, label: { show: true, position: 'top', formatter: p => Number(p.value).toFixed(2) } }] });
}
export async function trend(company: Analysis[number], pollutant: string, unit: string | null) {
  const records = company.records.filter(r => r.pollutant_type === pollutant && r.unit === unit);
  const ids = new Set(records.map(r => r.outlet_id));
  const outlets = company.outlets.filter(o => ids.has(o.id)).slice(0, 8);
  return render({ grid: { left: 75, right: 30, top: 55, bottom: 60 }, legend: { type: 'scroll' }, xAxis: { type: 'time', axisLabel: { formatter: value => new Date(Number(value) + 28800000).toISOString().slice(5, 10) } }, yAxis: { type: 'value', name: unit && /^[\x20-\x7E]+$/.test(unit) ? unit : '' }, series: outlets.map((o, i) => ({ name: `Outlet ${i + 1}`, type: 'line', showSymbol: records.length < 100, connectNulls: false, data: records.filter(r => r.outlet_id === o.id).sort((a, b) => Date.parse(a.monitored_at) - Date.parse(b.monitored_at)).map(r => [Date.parse(r.monitored_at), Number(r.value)]) })) });
}
