import { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, Packer, Footer, PageNumber, AlignmentType, ImageRun } from 'docx';
import { comparison, trend } from './chart';
import { exceeded, type Report, type Reading } from './model';
const fmt = (n: number | null | undefined) => n == null ? '—' : Number(n).toFixed(2);
const time = (s: string) => new Date(s).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const para = (text: string) => new Paragraph({ text, spacing: { after: 150, line: 280 } });
const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 260, after: 160 } });
function table(headers: string[], rows: (string | number)[][], widths: number[]) {
  const border = { style: 'single' as const, size: 4, color: 'D9D9D9' };
  return new Table({ width: { size: 9500, type: WidthType.DXA }, columnWidths: widths, rows: [headers, ...rows].map((row, i) => new TableRow({ tableHeader: i === 0, cantSplit: true, children: row.map((v, j) => new TableCell({ width: { size: widths[j], type: WidthType.DXA }, verticalAlign: 'center', shading: { fill: i === 0 ? 'E5EEF5' : i % 2 === 0 ? 'F6F8FA' : 'FFFFFF' }, borders: { top: border, bottom: border, left: border, right: border }, margins: { top: 90, bottom: 90, left: 100, right: 100 }, children: [new Paragraph({ alignment: j === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, spacing: { after: 0, line: 260 }, children: [new TextRun({ text: String(v), size: 19, bold: i === 0 })] })] })) })) });
}
export async function buildWord(report: Report) {
  const records = report.companies.flatMap(c => c.records);
  const exceptions = records.filter(exceeded).sort((a, b) => Date.parse(b.monitored_at) - Date.parse(a.monitored_at));
  const missing = records.filter(r => r.standard_limit === null).length;
  const title = report.role === 'admin' ? '园区水质监测管理报告' : '企业水质监测报告';
  const body: (Paragraph | Table)[] = [new Paragraph({ text: title, heading: HeadingLevel.TITLE }), para(report.role === 'admin' ? report.park : report.companies[0].company_name), para(`监测周期：${report.start} 至 ${report.end}（北京时间）`), para(`生成时间：${time(report.generated)}`), para(`本报告汇总所选日期内已审批排污口的监测数据，共${records.length}条记录，其中${exceptions.length}条严格超过记录中保存的阈值。请根据异常明细核查相关排污口。`), heading('一 监测概况'), table(['项目', '数量'], [['企业', report.companies.length], ['有数据企业', report.companies.filter(c => c.records.length).length], ['排污口', report.companies.reduce((s, c) => s + c.outlets.length, 0)], ['监测记录', records.length], ['超阈值记录', exceptions.length], ['缺少历史阈值的记录', missing]], [6500, 3000]), para('异常按原始监测记录的数值严格大于该记录阈值判定，等于阈值不计异常。缺少历史阈值的记录不参与超阈值判定，也不计为正常。'), heading('二 监测统计')];
  for (const c of report.companies) {
    body.push(para(c.company_name || '未命名企业'));
    if (!c.records.length) { body.push(para('本期无监测数据。')); continue; }
    const groups = new Map<string, Reading[]>();
    for (const r of c.records) { const key = JSON.stringify([r.outlet_id, r.pollutant_type, r.unit]); groups.set(key, [...(groups.get(key) ?? []), r]); }
    body.push(table(['排污口与指标', '单位', '均值', '峰值', '最新', '异常/记录'], [...groups.values()].map(rs => {
      const latest = [...rs].sort((a, b) => Date.parse(b.monitored_at) - Date.parse(a.monitored_at))[0];
      const label = c.metrics.find(p => p.id === latest.pollutant_type)?.label ?? latest.pollutant_type;
      return [`${c.outlets.find(o => o.id === latest.outlet_id)?.name ?? latest.outlet_id} ${label}`, latest.unit ?? '未记录', fmt(rs.reduce((s, r) => s + Number(r.value), 0) / rs.length), fmt(Math.max(...rs.map(r => Number(r.value)))), fmt(latest.value), `${rs.filter(exceeded).length}/${rs.length}`];
    }), [3000, 1100, 1300, 1300, 1300, 1500]));
  }
  body.push(heading('三 监测图表'));
  const picture = (data: Buffer) => new Paragraph({ children: [new ImageRun({ type: 'png', data, transformation: { width: 580, height: 255 }, altText: { name: '监测图表', title: '监测数据图表', description: '所选日期内的实际监测数据' } })], spacing: { after: 180 } });
  if (report.role === 'admin') {
    const chart = await comparison(report);
    body.push(para('企业CDC对比图展示有可用结果的前12家企业，完整结果见下方CDC分析。'));
    if (chart) { body.push(picture(chart)); body.push(para([...report.companies].filter(c => c.cdc !== null).sort((a,b) => (b.cdc ?? 0) - (a.cdc ?? 0)).slice(0,12).map((c,i) => `${i+1}：${c.company_name}`).join('；'))); }
  } else {
    const c = report.companies[0];
    const groups = new Map<string, { id: string; unit: string | null }>();
    for (const r of c.records) groups.set(JSON.stringify([r.pollutant_type, r.unit]), { id: r.pollutant_type, unit: r.unit });
    body.push(para('趋势图按指标及单位分别绘制原始监测值，最多展示6组指标、每组8个排污口。全部记录仍参与统计；线段只连接已有采样点，不代表中间时段实测值。'));
    for (const p of [...groups.values()].slice(0, 6)) {
      body.push(para(c.metrics.find(m => m.id === p.id)?.label ?? p.id));
      body.push(picture(await trend(c, p.id, p.unit)));
      const ids = new Set(c.records.filter(r => r.pollutant_type === p.id && r.unit === p.unit).map(r => r.outlet_id));
      body.push(para(c.outlets.filter(o => ids.has(o.id)).slice(0,8).map((o,i) => `Outlet ${i+1}：${o.name}`).join('；')));
    }
  }
  body.push(heading('四 CDC分析'), para('同一污染物、同一排污口每天取北京时间下监测时间最新的数值，再汇总企业各排污口。沿用现有模型：仅日汇总值大于零的日期参与统计，归一化及权重取同期园区企业参考数据。该汇总值不代表某个排污口的实际浓度。'), para('高、中、低风险为当前系统模型分级，不等同于法定水质类别。全部为零或没有可用统计样本时不输出低风险结论。'));
  for (const c of [...report.companies].sort((a, b) => (b.cdc ?? -1) - (a.cdc ?? -1))) {
    body.push(para(`${c.company_name}　CDC：${fmt(c.cdc)}　${c.cdc === null ? '样本不足' : c.cdc >= 1.5 ? '高风险' : c.cdc >= .5 ? '中风险' : '低风险'}`));
    if (c.metrics.length) body.push(table(['指标', 'AV', 'AD', 'CV', 'SKEW', 'CDC'], c.metrics.map(p => [p.label, fmt(p.stats?.av), fmt(p.stats?.ad), fmt(p.stats?.cv), fmt(p.stats?.skew), fmt(p.cdc)]), [2200, 1460, 1460, 1460, 1460, 1460]));
  }
  body.push(heading('五 管理建议'), para(exceptions.length ? '建议优先核查超阈值记录对应的监测设备、采样记录和处理设施运行情况，并安排复测。' : '本期有阈值的监测记录未发现超阈值情况，建议继续按监测计划采集数据。'), para(missing ? `有${missing}条记录缺少历史阈值，请核查来源及当时适用的配置后再作判断。` : '本期监测记录均保存了阈值。'), para('本报告不推断污染来源、治理效果或未监测时段的水质情况。'));
  body.push(heading('六 完整异常明细'));
  if (exceptions.length) body.push(table(['时间', '企业及排污口', '指标及单位', '数值', '阈值'], exceptions.map(r => {
    const c = report.companies.find(c => c.outlets.some(o => o.id === r.outlet_id))!;
    return [time(r.monitored_at), `${c.company_name} ${c.outlets.find(o => o.id === r.outlet_id)?.name}`, `${c.metrics.find(p => p.id === r.pollutant_type)?.label ?? r.pollutant_type} ${r.unit ?? ''}`, fmt(r.value), fmt(r.standard_limit)];
  }), [2200, 2700, 2000, 1300, 1300]));
  else body.push(para('本期无可判定的超阈值记录。'));
  return Packer.toBuffer(new Document({ title, creator: '水质监测系统', styles: { default: { document: { run: { font: 'Microsoft YaHei', size: 22, color: '000000' } } }, paragraphStyles: [{ id: 'Title', name: 'Title', basedOn: 'Normal', run: { size: 36, bold: true, color: '000000' } }, { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', run: { size: 26, bold: true, color: '000000' } }] }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1100, bottom: 1100, left: 1200, right: 1200 } } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT] })] })] }) }, children: body }] }));
}
