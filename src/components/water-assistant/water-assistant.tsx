'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { X, Download, Volume2, VolumeX, Loader2, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import styles from './water-assistant.module.css';

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
        const res = await fetch('/api/assistant/alerts', { headers: { 'x-auth-token': session.access_token }, cache: 'no-store', signal: controller.signal });
        if (res.ok) {
          const data: { warnings: { id: string; at: string }[] } = await res.json();
          const key = `water-alerts:${session.user.id}:${day(Date.now())}`;
          try { for (const id of JSON.parse(sessionStorage.getItem(key) ?? '[]')) seen.current.add(id); } catch { /* storage is optional */ }
          const fresh = data.warnings.filter(w => !seen.current.has(w.id));
          if (fresh.length) {
            fresh.forEach(w => seen.current.add(w.id));
            try { sessionStorage.setItem(key, JSON.stringify([...seen.current])); } catch { /* storage is optional */ }
            setMessage(`发现${fresh.length}条新的超阈值记录，请查看监测页面。`); animate('warning'); play('warning');
          }
        }
      } catch { /* Retry transient failures without announcing a false all-clear. */ }
      if (!controller.signal.aborted) timer = setTimeout(poll, 60000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [active, session, play, animate]);
  const move = (p: Point) => { const next = keepInside(p); setPosition(next); try { localStorage.setItem('water-assistant-position', JSON.stringify(next)); } catch { /* optional browser storage */ } };
  async function generate() {
    if (!session || busy) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setMessage('稍等一下，我来整理监测数据！'); setDownload(null);
    if (downloadRef.current) { URL.revokeObjectURL(downloadRef.current); downloadRef.current = null; }
    try {
      const res = await fetch(`/api/${role}/reports/word`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': session.access_token }, body: JSON.stringify({ startDate, endDate }), signal: controller.signal });
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
  return <div ref={root} className={styles.root} style={{ left: position.x, top: position.y }}>
    {open && <section ref={panel} tabIndex={-1} className={styles.panel} style={{ left: Math.max(12, Math.min(window.innerWidth - 362, position.x > 360 ? position.x - 360 : position.x + 160)), top: Math.max(12, Math.min(window.innerHeight - 450, position.y - 100)) }} aria-label="小水滴操作面板">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-teal-900">小水滴 · {role === 'admin' ? '园区助手' : '企业助手'}</h2><Button size="icon" variant="ghost" aria-label="收起面板" onClick={() => { setOpen(false); pet.current?.focus(); }}><X className="size-4" /></Button></div>
      <p className="text-sm text-slate-500">{role === 'admin' ? '生成所属园区的监测报告' : '生成本企业的监测报告'}</p>
      <div className="mt-4 grid grid-cols-2 gap-3"><div><Label htmlFor="water-start">开始日期</Label><Input id="water-start" type="date" value={startDate} max={endDate || undefined} onChange={e => setStart(e.target.value)} disabled={busy} /></div><div><Label htmlFor="water-end">结束日期</Label><Input id="water-end" type="date" value={endDate} min={startDate || undefined} onChange={e => setEnd(e.target.value)} disabled={busy} /></div></div>
      <Button className="mt-4 w-full bg-teal-700 hover:bg-teal-800" disabled={busy || demoStep !== null || !startDate || !endDate || startDate > endDate} onClick={generate}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{busy ? '正在生成报告…' : '生成Word报告'}</Button>
      {download && <a className="mt-2 block text-center text-sm text-teal-700 underline" href={download} download={filename}>再次下载报告</a>}
      <div className="mt-4 border-t border-teal-100 pt-4">
        <Button className="w-full" variant="outline" disabled={demoStep !== null || busy} onClick={prepareDemo}>{demoStep !== null ? <Loader2 className="size-4 animate-spin" /> : <Waves className="size-4" />}{demoStep !== null ? '正在准备演示…' : '查看污染扩散演示'}</Button>
        {demoStep !== null && <div className="mt-2 text-sm text-teal-700" role="status">{['正在加载三维网格…', '正在准备扩散动画…', '演示准备完成。'][demoStep]}<Button variant="ghost" size="sm" onClick={cancelDemo}>取消</Button></div>}
        <p className="mt-2 text-xs text-slate-500">固定场景示意 · 非实时预测</p>
      </div>
      <p className="mt-3 text-sm text-slate-700" role="status">{message}</p>
      <Button className="mt-2" variant="ghost" onClick={() => { const enabled = !voice; setVoice(enabled); try { localStorage.setItem('water-assistant-voice', String(enabled)); } catch { /* optional */ } if (enabled) play('enabled', true); else sound.current?.pause(); }}>{voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}{voice ? '语音已开启' : '开启语音提示'}</Button>
    </section>}
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
