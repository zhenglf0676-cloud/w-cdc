'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft } from 'lucide-react';
import './terrain-lab.css';

const chapters = [
  { number: '01', label: '雪山 · 起源', title: '一滴水，\n从雪山出发。', copy: '镜头从真实山脊出发。雪与岩石有高度、坡向和深度，向前飞行时近景与远山的相对位置会改变。' },
  { number: '02', label: '冰川 · 融化', title: '融化，\n是旅程的开始。', copy: '靠近冰川与山谷，沿地形的坡度寻找水的去向。' },
  { number: '03', label: '峡谷 · 穿行', title: '穿过峡谷，\n看见变化。', copy: '镜头继续沿河谷推进，山体的前后遮挡与航拍画面一起变化。' },
  { number: '04', label: '河流 · 汇聚', title: '从山间，\n流向更远处。', copy: '在河流转弯处放缓镜头，让故事从自然过渡到监测与守护。' },
  { number: '05', label: '海洋 · 守护', title: '终归大海，\n守护始于此。', copy: '同一条镜头路线抵达海岸。这里是视觉叙事试验，不是水质数据或污染扩散模拟。' },
];

export function TerrainLab() {
  const [status, setStatus] = useState('正在加载真实地形…');

  useEffect(() => {
    const handleStatus = (event: Event) => setStatus((event as CustomEvent<string>).detail);
    window.addEventListener('wcdc-terrain-status', handleStatus);
    const styles = document.createElement('link');
    styles.rel = 'stylesheet';
    styles.href = 'https://js.arcgis.com/4.34/esri/themes/dark/main.css';
    document.head.appendChild(styles);
    const script = document.createElement('script');
    script.type = 'module';
    script.src = '/landing/terrain-lab.mjs';
    script.onerror = () => setStatus('三维地形加载失败，请检查网络和 WebGL 设置');
    document.body.appendChild(script);
    return () => {
      window.removeEventListener('wcdc-terrain-status', handleStatus);
      window.dispatchEvent(new Event('wcdc-terrain-dispose'));
      script.remove();
      styles.remove();
    };
  }, []);

  return <div className="terrain-lab">
    <div id="terrain-lab-view" className="terrain-lab-view" aria-hidden="true" />
    <div className="terrain-lab-shade" aria-hidden="true" />
    <header className="terrain-lab-header">
      <Link href="/" aria-label="返回首页"><ArrowLeft size={17} /> W·CDC</Link>
      <span>真实地貌 · 三维镜头试验</span>
      <Link href="/login">登录平台 ↗</Link>
    </header>
    <output className="terrain-lab-status" aria-live="polite">{status}</output>
    <main>
      {chapters.map((chapter, index) => <section key={chapter.number} className="terrain-lab-chapter" data-terrain-chapter>
        <div className="terrain-lab-content">
          <p>{chapter.number} / 05&nbsp; {chapter.label}</p>
          {index === 0 ? <h1>{chapter.title}</h1> : <h2>{chapter.title}</h2>}
          <span>{chapter.copy}</span>
          {index < chapters.length - 1 && <a href={`#terrain-${index + 1}`} aria-label="继续探索"><ArrowDown size={22} /></a>}
        </div>
        <div id={`terrain-${index + 1}`} className="terrain-lab-anchor" aria-hidden="true" />
      </section>)}
    </main>
    <div className="terrain-lab-credit">三维地形与卫星影像 © Esri 及数据提供方 · 仅作视觉试验 · 非监测地点</div>
  </div>;
}
