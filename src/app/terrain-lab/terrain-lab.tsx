'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft } from 'lucide-react';
import './terrain-lab.css';

const chapters = [
  { number: '01', label: '雪山 · 起源', title: '一滴水，\n从雪山出发。', copy: '风掠过山脊，积雪在晨光里苏醒。循着一滴水，走进山海之间。' },
  { number: '02', label: '冰川 · 融化', title: '融化，\n是旅程的开始。', copy: '冰雪化作细流，在岩石之间汇聚。每一条河流，都有一个微小的起点。' },
  { number: '03', label: '峡谷 · 穿行', title: '穿过峡谷，\n看见变化。', copy: '水流雕刻岩壁，也记录沿途的变化。穿过层叠山谷，生命在两岸生长。' },
  { number: '04', label: '河流 · 汇聚', title: '从山间，\n流向更远处。', copy: '支流汇聚，森林延展。让每一次细微变化被看见，让每一份守护有迹可循。' },
  { number: '05', label: '海洋 · 守护', title: '终归大海，\n守护始于此。', copy: '从源头到入海，每一程都值得守护。W·CDC，让水质变化清晰可见。' },
];

export function TerrainLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('正在准备山海旅程…');

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    import('./journey-scene').then(({ mountJourney }) => {
      if (cancelled || !canvasRef.current) return;
      dispose = mountJourney(canvasRef.current, setStatus);
    }).catch(() => {
      if (!cancelled) setStatus('三维场景未能启动，请刷新重试或检查浏览器图形加速');
    });
    return () => { cancelled = true; dispose?.(); };
  }, []);

  return <div className="terrain-lab">
    <canvas ref={canvasRef} className="terrain-lab-view" aria-hidden="true" />
    <div className="terrain-lab-shade" aria-hidden="true" />
    <header className="terrain-lab-header">
      <Link href="/" aria-label="返回首页"><ArrowLeft size={17} /> W·CDC</Link>
      <span>一滴水的山海旅程</span>
      <Link href="/login">登录平台 ↗</Link>
    </header>
    <output className="terrain-lab-status" aria-live="polite">{status}</output>
    <main>
      {chapters.map((chapter, index) => <section id={`terrain-${index}`} key={chapter.number} className="terrain-lab-chapter" data-terrain-chapter>
        <div className="terrain-lab-content">
          <p>{chapter.number} / 05&nbsp; {chapter.label}</p>
          {index === 0 ? <h1>{chapter.title}</h1> : <h2>{chapter.title}</h2>}
          <span>{chapter.copy}</span>
          {index === chapters.length - 1 && <Link href="/login">进入监测平台 ↗</Link>}
          {index < chapters.length - 1 && <a href={`#terrain-${index + 1}`} aria-label="继续探索"><ArrowDown size={22} /></a>}
        </div>
      </section>)}
    </main>
    <div className="terrain-lab-credit">艺术化三维景观 · 非监测地点或水流预测</div>
  </div>;
}
