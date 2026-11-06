import type { EChartsOption } from 'echarts';

/** Export is opt-in; ordinary analysis and image reading keep their existing UI. */
export function wantsChartDownload(question: string): boolean {
  return /图|曲线|趋势|png/i.test(question) && /下载|导出|保存|存下来|存成/i.test(question) &&
    !/(不用|不要|不需要|无需).{0,8}(下载|导出|保存|图片|图表)/.test(question);
}

/** Reuse the displayed snapshot only for a plain reference, never a new date/filter/type request. */
export function reusesPreviousChart(question: string): boolean {
  if (!wantsChartDownload(question)) return false;
  if (/(生成|绘制|画)/.test(question) && !/(刚才|刚刚|上面|上述|之前|上一[轮条次]|这[些个张幅]?|那[些个张幅]?)/.test(question)) return false;
  const rest = question.replace(/(?:刚才|刚刚|上面|上述|之前|上一[轮条次]|这[些个张幅]?|那[些个张幅]?|的|图表|图片|趋势图|曲线图|折线图|图|曲线|趋势|请|帮我|给我|可以|能不能|我要|我想|把|将|提供|生成|一份|一张|一个|可|能|下载|导出|保存|存下来|存成|为|成|下来|一下|到本地|高清|PNG|格式|文件|吗|吧|。|，|？|！|\s)/gi, '');
  return rest.length === 0;
}

export type DownloadChart = {
  id: string;
  title: string;
  subtitle: string;
  footnotes: string[];
  option: EChartsOption;
};

export const CHART_EXPORT_WIDTH = 1200;
export const CHART_EXPORT_HEIGHT = 800;

export function chartFileName(chart: DownloadChart): string {
  return `${chart.title}-${chart.id}`.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 160) + '.png';
}

/** Keep the exact series and dates; only adjust layout for a standalone, readable image. */
export function downloadableOption(chart: DownloadChart): EChartsOption {
  return {
    ...chart.option,
    animation: false,
    backgroundColor: '#ffffff',
    textStyle: { fontFamily: 'sans-serif' },
    title: {
      text: chart.title, subtext: chart.subtitle, left: 36, top: 24,
      textStyle: { fontSize: 22, color: '#134e4a', width: 1120, overflow: 'break' },
      subtextStyle: { fontSize: 13, color: '#475569', lineHeight: 22 },
    },
    grid: { left: 64, right: 48, top: 140, bottom: 230, containLabel: true },
    // Plain vertical legend ensures all displayed series appear in the downloaded image.
    legend: { type: 'plain', orient: 'vertical', left: 64, top: 585, itemGap: 6, textStyle: { fontSize: 12, width: 1070, overflow: 'truncate' } },
    graphic: [{ type: 'text', left: 36, top: 715, style: {
      text: chart.footnotes.join('\n'), fill: '#64748b', font: '12px sans-serif', lineHeight: 20,
      width: 1128, overflow: 'break',
    } }],
  };
}
