'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { X, Download, Volume2, VolumeX, Loader2, Waves, Sparkles, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { assistantFetch } from '@/lib/water-assistant/request';
import styles from './water-assistant.module.css';
import { AiChat } from './ai-chat';

type Point = { x: number; y: number };
const day = (n: number) => new Date(n + 28800000).toISOString().slice(0, 10);
const keepInside = (p: Point): Point => ({ x: Math.max(0, Math.min(window.innerWidth - Math.min(230, window.innerWidth * .42), p.x)), y: Math.max(70, Math.min(window.innerHeight - Math.min(290, window.innerHeight * .35), p.y)) });
export function WaterAssistant() {
  const { session } = useAuth();
  const pathname = usePathname();
  const active = !!session && /^\/(enterprise|admin)(\/|$)/.test(pathname);
  const role = pathname.startsWith('/admin') ? 'admin' : 'enterprise';
  const [position, setPosition] = useState<Point | null>(null);
  const [open, setOpen] = useState(false), [voice, setVoice] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('嗨，我是小水滴！让我们守护水质健康吧。');
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoStep, setDemoStep] = useState<number | null>(null);
  const demoFrame = useRef<HTMLIFrameElement>(null);
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelDemo = useCallback(() => { demoTimers.current.forEach(clearTimeout); demoTimers.current = []; setDemoStep(null); }, []);
  const [action, setAction] = useState('idle');
  const [startDate, setStart] = useState(''), [endDate, setEnd] = useState('');
  const [download, setDownload] = useState<string | null>(null);
  const [filename, setFilename] = useState('水质监测报告.docx');
  const root = useRef<HTMLDivElement>(null), panel = useRef<HTMLElement>(null), pet = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; origin: Point; moved: boolean } | null>(null);
  const wasDragged = useRef(false), sound = useRef<HTMLAudioElement | null>(null), animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const downloadRef = useRef<string | null>(null);
  const seen = useRef(new Set<string>());
  const play = useCallback((name: string, enabled = voice) => {
    if (!enabled) return;
    sound.current?.pause();
    sound.current = new Audio(`/water-assistant/audio/${name}.mp3`);
    void sound.current.play().catch(() => { setMessage('点击语音按钮后即可开启声音提示。'); });
  }, [voice]);
  const animate = useCallback((name: string) => {
    setAction(name);
    if (animTimer.current) clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => setAction('idle'), 2100);
  }, []);
  useEffect(() => {
    const initial = { x: window.innerWidth - 250, y: window.innerHeight - 320 };
    try { const value = JSON.parse(localStorage.getItem('water-assistant-position') ?? 'null'); if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) { initial.x = value.x; initial.y = value.y; } setVoice(localStorage.getItem('water-assistant-voice') === 'true'); } catch { /* optional browser storage */ }
    setPosition(keepInside(initial));
    setStart(day(Date.now() - 6 * 86400000)); setEnd(day(Date.now()));
    const resize = () => setPosition(p => p ? keepInside(p) : p);
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); sound.current?.pause(); if (animTimer.current) clearTimeout(animTimer.current); request.current?.abort(); if (downloadRef.current) URL.revokeObjectURL(downloadRef.current); };
  }, []);
  useEffect(() => {
    setOpen(false); setDownload(null); setBusy(false); seen.current = new Set();
    request.current?.abort(); sound.current?.pause();
    if (downloadRef.current) { URL.revokeObjectURL(downloadRef.current); downloadRef.current = null; }
    setMessage('嗨，我是小水滴！让我们守护水质健康吧。');
  }, [session?.user.id]);
  useEffect(() => { setOpen(false); setDemoOpen(false); cancelDemo(); }, [pathname, session?.user.id, cancelDemo]);
  useEffect(() => { if (!open) cancelDemo(); return () => demoTimers.current.forEach(clearTimeout); }, [open, cancelDemo]);
  useEffect(() => {
    if (!demoOpen) return;
    const closeFromFrame = (event: MessageEvent) => {
      if (event.source === demoFrame.current?.contentWindow && event.data === 'water-demo-close') setDemoOpen(false);
    };
    window.addEventListener('message', closeFromFrame);
    return () => window.removeEventListener('message', closeFromFrame);
  }, [demoOpen]);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const close = (e: PointerEvent) => { if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); pet.current?.focus(); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  useEffect(() => {
    if (!active || !session) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === 'visible') try {
        const res = await assistantFetch(token => fetch('/api/assistant/alerts', { headers: { 'x-auth-token': token }, cache: 'no-store', signal: controller.signal }), controller.signal);
        if (res.ok) {
          const data: { warnings: { id: string; at: string }[] } = await res.json();
          const key = `water-alerts:${session.user.id}:${day(Date.now())}`;
          try { for (const id of JSON.parse(localStorage.getItem(key) ?? '[]')) seen.current.add(id); } catch { /* storage is optional */ }
          const fresh = data.warnings.filter(w => !seen.current.has(w.id));
          if (fresh.length) {
            fresh.forEach(w => seen.current.add(w.id));
            try { localStorage.setItem(key, JSON.stringify([...seen.current])); } catch { /* storage is optional */ }
            setMessage(`发现${fresh.length}条新的超阈值记录，请查看监测页面。`); animate('warning'); play('warning');
          }
        }
      } catch { /* Retry transient failures without announcing a false all-clear. */ }
      if (!controller.signal.aborted) timer = setTimeout(poll, 60000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [active, session, play, animate]);
  useEffect(() => {
    if (!active || !session) return;
    const announceImport = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail?.userId !== session.user.id) return;
      const detail = event.detail as { warnings?: string[]; warningRecords?: { id: string; at: string }[] };
      const today = day(Date.now());
      const key = `water-alerts:${session.user.id}:${today}`;
      try { for (const id of JSON.parse(localStorage.getItem(key) ?? '[]')) seen.current.add(id); } catch { /* storage is optional */ }
      const unannounced = (detail.warningRecords ?? []).some(record => !seen.current.has(record.id));
      for (const record of detail.warningRecords ?? []) {
        if (day(new Date(record.at).getTime()) === today) seen.current.add(record.id);
      }
      try { localStorage.setItem(key, JSON.stringify([...seen.current])); } catch { /* storage is optional */ }
      if (detail.warnings?.length && unannounced) {
        setMessage(`刚录入的数据中发现${detail.warnings.length}类超阈值指标，请查看监测页面。`);
        animate('warning');
        play('warning');
      }
    };
    window.addEventListener('water-monitoring-imported', announceImport);
    return () => window.removeEventListener('water-monitoring-imported', announceImport);
  }, [active, session, play, animate]);
  const move = (p: Point) => { const next = keepInside(p); setPosition(next); try { localStorage.setItem('water-assistant-position', JSON.stringify(next)); } catch { /* optional browser storage */ } };
  async function generate() {
    if (!session || busy) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setMessage('稍等一下，我来整理监测数据！'); setDownload(null);
    if (downloadRef.current) { URL.revokeObjectURL(downloadRef.current); downloadRef.current = null; }
    try {
      const payload = JSON.stringify({ startDate, endDate });
      const res = await assistantFetch(token => fetch(`/api/${role}/reports/word`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: payload, signal: controller.signal }), controller.signal);
      if (!res.ok) { const error = await res.json(); throw new Error(error.error ?? '报告生成失败'); }
      const blob = await res.blob(); if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob), name = `${role === 'admin' ? '园区' : '企业'}水质监测报告_${startDate}_${endDate}.docx`;
      downloadRef.current = url; setDownload(url); setFilename(name);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      setMessage('报告整理好啦！可以下载查看了。'); animate('report'); play('report');
    } catch (e) { if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : '生成失败，请重试'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function prepareDemo() {
    if (demoStep !== null) return;
    cancelDemo(); setDemoStep(0); setMessage('来看看污染物是怎么扩散的吧！'); animate('greet');
    if (voice) play('simulation');
    demoTimers.current = [
      setTimeout(() => setDemoStep(1), 800),
      setTimeout(() => setDemoStep(2), 1600),
      setTimeout(() => { setDemoOpen(true); setOpen(false); setMessage('演示准备好啦，可以旋转模型或剖切查看。'); }, 2400),
    ];
  }
  if (!active || !position) return null;
  const viewportWidth = window.innerWidth;
  const workspaceWidth = Math.min(980, viewportWidth - 24);
  const petWidth = Math.min(230, viewportWidth * .42);
  const workspaceLeft = position.x > workspaceWidth + 16
    ? position.x - workspaceWidth - 12
    : position.x + petWidth + workspaceWidth + 24 <= viewportWidth
      ? position.x + petWidth + 12
      : Math.max(12, Math.min(viewportWidth - workspaceWidth - 12, position.x - workspaceWidth / 2));
  const workspaceTop = Math.max(12, Math.min(window.innerHeight - Math.min(720, window.innerHeight - 24) - 12, position.y - 200));
  return <div ref={root} className={styles.root} style={{ left: position.x, top: position.y }}>
    <section ref={panel} tabIndex={-1} className={styles.workspace} style={{ display: open ? undefined : 'none', left: workspaceLeft, top: workspaceTop }} aria-label="小水滴工作台">
      <header className={styles['workspace-header']}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/20"><Droplets className="size-6" /></span>
        <div className="min-w-0 flex-1"><h2 className="flex items-center gap-2 font-semibold">小水滴 · {role === 'admin' ? '园区智能助手' : '企业智能助手'} <Sparkles className="size-4 text-cyan-200" /></h2><p className="mt-0.5 text-xs text-teal-100">自然语言分析水质 · 常用功能一键直达</p></div>
        <Button size="icon" variant="ghost" className="shrink-0 text-white hover:bg-white/20 hover:text-white" aria-label="收起小水滴工作台" onClick={() => { setOpen(false); pet.current?.focus(); }}><X className="size-4" /></Button>
      </header>
      <div className={styles['workspace-body']}>
        <div className={styles['conversation-pane']}><AiChat key={`${session.user.id}:${role}`} userId={session.user.id} scope={role === 'admin' ? '所属园区' : '本企业'} canImport={role === 'enterprise'} /></div>
        <aside className={styles['tools-pane']} aria-label="快捷操作">
          <div className={styles['tools-title']}><span className="font-semibold text-teal-950">快捷操作</span><span className="text-xs text-slate-500">监测与演示</span></div>
          <div className={styles['quick-grid']}>
            <Button variant="outline" className={styles['quick-button']} disabled={busy || demoStep !== null || !startDate || !endDate || startDate > endDate} onClick={generate}>{busy ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}<span>{busy ? '正在生成…' : '生成Word报告'}</span></Button>
            <Button variant="outline" className={styles['quick-button']} aria-pressed={voice} onClick={() => { const enabled = !voice; setVoice(enabled); try { localStorage.setItem('water-assistant-voice', String(enabled)); } catch { /* optional */ } if (enabled) play('enabled', true); else sound.current?.pause(); }}>{voice ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}<span>{voice ? '语音已开启' : '开启语音提示'}</span></Button>
            <Button variant="outline" className={styles['quick-button']} disabled={demoStep !== null || busy} onClick={prepareDemo}>{demoStep !== null ? <Loader2 className="size-5 animate-spin" /> : <Waves className="size-5" />}<span>{demoStep !== null ? '准备演示中…' : '污染扩散演示'}</span></Button>
          </div>
          <details className={styles['date-settings']}><summary className="cursor-pointer text-xs font-medium text-teal-800">调整报告时间 · 默认近7天</summary><div className="mt-3 grid grid-cols-2 gap-2"><div><Label htmlFor="water-start" className="text-xs">开始日期</Label><Input id="water-start" type="date" value={startDate} max={endDate || undefined} onChange={e => setStart(e.target.value)} disabled={busy} className="mt-1" /></div><div><Label htmlFor="water-end" className="text-xs">结束日期</Label><Input id="water-end" type="date" value={endDate} min={startDate || undefined} onChange={e => setEnd(e.target.value)} disabled={busy} className="mt-1" /></div></div></details>
          {download && <a className="block text-xs font-medium text-teal-700 underline" href={download} download={filename}>再次下载报告</a>}
          {demoStep !== null && <div className="text-xs text-teal-700" role="status">{['正在加载三维网格…', '正在准备扩散动画…', '演示准备完成。'][demoStep]}<Button variant="ghost" size="sm" onClick={cancelDemo}>取消</Button></div>}
          <p className={styles['tool-status']} role="status">{message}</p>
          <p className="text-xs text-slate-500">污染演示为固定场景示意，非实时预测。</p>
        </aside>
      </div>
    </section>
    <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
      <DialogContent className="flex h-[94dvh] w-[96vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[1400px]" showCloseButton={false} onCloseAutoFocus={e => { e.preventDefault(); pet.current?.focus(); }}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <div><DialogTitle>污染扩散演示</DialogTitle><DialogDescription className="mt-1 text-xs">固定场景示意，非实时预测。关闭后返回原页面。</DialogDescription></div>
          <DialogClose asChild><Button variant="ghost" size="icon" aria-label="关闭污染扩散演示"><X className="size-4" /></Button></DialogClose>
        </div>
        {demoOpen && <iframe ref={demoFrame} title="三维网格污染扩散演示" src="/water-assistant/pollution-demo.html?autoplay=1" sandbox="allow-scripts" className="min-h-0 w-full flex-1 border-0" />}
      </DialogContent>
    </Dialog>
    {!open && !demoOpen && <div className={styles.bubble} role="status">{message}</div>}
    <button ref={pet} className={styles.pet} data-action={action} aria-label="小水滴，点击展开助手，拖动调整位置，方向键移动" aria-expanded={open}
      onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); wasDragged.current = false; drag.current = { x: e.clientX, y: e.clientY, origin: position, moved: false }; }}
      onPointerMove={e => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.hypot(dx, dy) > 6) d.moved = true; if (d.moved) { wasDragged.current = true; setOpen(false); move({ x: d.origin.x + dx, y: d.origin.y + dy }); } }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; wasDragged.current = true; }}
      onClick={() => { if (wasDragged.current) { wasDragged.current = false; return; } setOpen(v => !v); animate('greet'); }}
      onKeyDown={e => { const arrows: Record<string, Point> = { ArrowLeft: { x: -15, y: 0 }, ArrowRight: { x: 15, y: 0 }, ArrowUp: { x: 0, y: -15 }, ArrowDown: { x: 0, y: 15 } }; const delta = arrows[e.key]; if (delta) { e.preventDefault(); move({ x: position.x + delta.x, y: position.y + delta.y }); } }}>
      <Image src="/water-assistant/mascot.png" alt="小水滴" width={230} height={290} draggable={false} unoptimized priority />
    </button>
  </div>;
}
