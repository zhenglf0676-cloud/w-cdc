'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import './alpine.css';

export function AlpineOpening() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('正在准备雪山开场…');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    let dispose: (() => void) | undefined;
    import('./alpine-scene').then(async ({ mountAlpine }) => {
      if (!canvas.current || abort.signal.aborted) return;
      const cleanup = await mountAlpine(canvas.current, abort.signal, message => {
        if (abort.signal.aborted) return;
        setStatus(message);
        setReady(message === '雪山开场已就绪');
        if (message.includes('中断')) setFailed(true);
      });
      if (abort.signal.aborted) cleanup(); else dispose = cleanup;
    }).catch(error => {
      if (abort.signal.aborted) return;
      console.error('Alpine opening failed',error);
      setFailed(true);setStatus('三维场景未能启动，请刷新重试。若仍失败，请检查浏览器图形加速。');
    });
    return () => { abort.abort(); dispose?.(); };
  }, []);
  return <div className="alpine-opening">
    <canvas ref={canvas} className="alpine-canvas" aria-hidden="true" />
    <div className="alpine-vignette" aria-hidden="true" />
    <header className="alpine-nav">
      <Link href="/" className="alpine-logo" aria-label="W·CDC 首页">W·CDC<span>每一滴，都值得守护</span></Link>
      <span className="alpine-edition">THE ORIGIN OF WATER</span>
      <Link href="/login">进入平台 <span aria-hidden="true">↗</span></Link>
    </header>
    <main>
      <section className="alpine-section alpine-first">
        <div className="alpine-copy">
          <p className="alpine-eyebrow">01 — 雪山 · 起源</p>
          <h1>万水之源。<span>万物之始。</span></h1>
          <p className="alpine-caption">从一场雪，到一滴水。<br />循着自然的轨迹，看见每一次变化。</p>
          <a className="alpine-explore" href="#alpine-ridge">向下探索 <span aria-hidden="true">↓</span></a>
        </div>
      </section>
      <section className="alpine-section" id="alpine-ridge">
        <div className="alpine-copy alpine-quiet">
          <p className="alpine-eyebrow">02 — 靠近山脊</p>
          <h2>时间，<br />刻在山的纹理里。</h2>
          <p className="alpine-caption">光越过山脊，冰雪覆于岩层。<br />静谧之下，旅程正在发生。</p>
        </div>
      </section>
      <section className="alpine-section" id="alpine-ice">
        <div className="alpine-copy alpine-quiet">
          <p className="alpine-eyebrow">03 — 冰雪之间</p>
          <h2>故事，<br />从这里流向远方。</h2>
          <p className="alpine-caption">雪山开场 · 视觉试验</p>
          <Link className="alpine-explore" href="/terrain-lab">查看河谷路线试验 <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </main>
    <output className={`alpine-status ${ready && !failed ? 'alpine-status-ready' : ''}`} aria-live="polite">{status}{failed && <button onClick={() => window.location.reload()}>重新加载</button>}</output>
    <footer className="alpine-footer"><span>WATER · NATURE · INSIGHT</span><span>艺术化三维景观 / 非监测地点</span></footer>
  </div>;
}
