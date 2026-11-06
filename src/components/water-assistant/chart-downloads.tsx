'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FileImage, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { chartsFromEvidence } from '@/lib/water-assistant/chart-evidence';
import { CHART_EXPORT_HEIGHT, CHART_EXPORT_WIDTH, chartFileName, downloadableOption, type DownloadChart } from '@/lib/water-assistant/chart-export';

function ChartDownloadCard({ chart }: { chart: DownloadChart }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function download() {
    if (busy) return;
    setBusy(true); setStatus('');
    let host: HTMLDivElement | undefined;
    let instance: import('echarts').ECharts | undefined;
    try {
      // Loaded on demand. Render independently of mobile viewport, hover state or legend selection.
      const echarts = await import('echarts');
      await document.fonts.ready;
      if (!mounted.current) return;
      host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = `position:fixed;left:-10000px;top:0;width:${CHART_EXPORT_WIDTH}px;height:${CHART_EXPORT_HEIGHT}px;pointer-events:none;`;
      document.body.appendChild(host);
      instance = echarts.init(host, undefined, { renderer: 'canvas', width: CHART_EXPORT_WIDTH, height: CHART_EXPORT_HEIGHT });
      instance.setOption(downloadableOption(chart), { notMerge: true, lazyUpdate: false });
      instance.getZr().flush();
      const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
      if (!url.startsWith('data:image/png') || url.length < 100) throw new Error('empty image');
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = chartFileName(chart);
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setStatus('已发起 PNG 下载');
    } catch {
      if (mounted.current) setStatus('图片导出失败，请重试；原图表仍可查看。');
    } finally {
      instance?.dispose(); host?.remove();
      if (mounted.current) setBusy(false);
    }
  }

  return <div className="rounded-xl border border-teal-100 bg-white px-3 py-2.5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <FileImage className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden="true" />
        <div className="min-w-0"><p className="break-words text-xs font-semibold text-slate-800">{chart.title}</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{chart.subtitle}</p></div>
      </div>
      <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 border-teal-200 text-xs text-teal-800" disabled={busy} onClick={() => void download()} aria-label={`下载 PNG：${chart.title}`}>
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}{busy ? '生成中' : '下载 PNG'}
      </Button>
    </div>
    {status && <p role="status" className="mt-2 text-xs text-slate-600">{status}</p>}
  </div>;
}

export function ChartDownloads({ evidence }: { evidence: unknown[] }) {
  const charts = chartsFromEvidence(evidence);
  return <section className="mt-3 space-y-2 border-t border-teal-100 pt-3" aria-label="可下载的分析图表">
    <p className="text-xs font-semibold text-teal-900">图表下载 <span className="font-normal text-slate-500">· PNG · 2400 × 1600</span></p>
    {charts.length ? <>
      {charts.map(chart => <ChartDownloadCard key={chart.id} chart={chart} />)}
      <p className="text-[11px] leading-relaxed text-slate-500">沿用该轮回答的图表数据和展示范围，附日期、单位与统计口径；导出包含图中全部序列。</p>
    </> : <p className="text-xs text-slate-600">本轮没有可导出的监测图表。请指定有记录的时段重新查询；不会用零值代替缺失数据。</p>}
  </section>;
}
