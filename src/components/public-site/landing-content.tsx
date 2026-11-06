'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import { PublicFooter, PublicHeader } from './chrome';
import '@/app/landing.css';
import '@/app/landing-cinema.css';

const abilities = [
  {
    number: '01', eyebrow: '每一条记录，都有来处', title: ['看见', '每一个排污口。'],
    description: '从企业到排污口，再到污染物与监测时间。先找到数据的位置，才谈得上理解变化。',
    image: '/landing/river.webp', alt: '森林与水流的航拍自然景观',
  },
  {
    number: '02', eyebrow: '让时间参与判断', title: ['读懂', '长期的变化。'],
    description: '把今天的读数放进历史里，结合波动指标与 CDC 分析，观察偏离、持续与反弹。',
    image: '/landing/karst.webp', alt: '喀斯特山地与河流的自然景观',
  },
  {
    number: '03', eyebrow: '从原始表格走向可追溯记录', title: ['让数据', '进入分析。'],
    description: 'Excel 拖入后先预检，再按企业、排污口、污染物和日期录入。异常读数有据可查。',
    image: '/landing/lake.webp', alt: '山谷与湖泊的航拍自然景观',
  },
  {
    number: '04', eyebrow: '让问题有数据，也有依据', title: ['与小水滴', '一起求证。'],
    description: '在授权范围内结合监测记录、历史对比与资料库追问原因，查看分析过程和报告。',
    image: '/landing/hero.webp', alt: '薄雾中的山间湖泊与水边人物',
  },
];

function useLandingMotion() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const stages = Array.from(document.querySelectorAll<HTMLElement>('[data-landing-stage]'));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previous = -1;
    const update = () => {
      const viewport = window.innerHeight;
      let nearest = 0;
      let distance = Infinity;
      stages.forEach((stage, index) => {
        const rect = stage.getBoundingClientRect();
        const value = Math.abs(rect.top + Math.min(rect.height, viewport) / 2 - viewport / 2);
        if (value < distance) { distance = value; nearest = index; }
        if (!reduced.matches) {
          const progress = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height - viewport)));
          stage.style.setProperty('--scene-progress', progress.toFixed(3));
          stage.style.setProperty('--scene-shift', (progress * -7).toFixed(2) + 'vh');
          stage.style.setProperty('--scene-zoom', (1.14 - progress * 0.09).toFixed(3));
          stage.style.setProperty('--horizon-shift', (progress * 11 - 5).toFixed(2) + 'vh');
        }
      });
      stages.forEach((stage, index) => {
        const value = index === nearest ? 'true' : 'false';
        if (stage.dataset.active !== value) stage.dataset.active = value;
      });
      if (previous !== nearest) { previous = nearest; setActive(nearest); }
      frame = 0;
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reduced.addEventListener('change', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reduced.removeEventListener('change', schedule);
      window.cancelAnimationFrame(frame);
    };
  }, []);
  return active;
}

function Landscape({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <>
      <div className="landing-scene-photo"><Image src={src} alt={alt} fill priority={priority} sizes="100vw" className="object-cover" /></div>
      <div className="landing-scene-haze" aria-hidden="true" />
      <div className="landing-scene-shade" aria-hidden="true" />
      <div className="landing-horizon" aria-hidden="true"><span className="landing-horizon-outer" /><span className="landing-horizon-middle" /><span className="landing-horizon-inner" /></div>
    </>
  );
}

export function LandingContent() {
  const active = useLandingMotion();
  return (
    <div className="public-site landing-world">
      <PublicHeader />
      <nav className="landing-chapter-rail" aria-label="页面章节">
        <span className="landing-rail-name">W·CDC / WATER INTELLIGENCE</span>
        <div>
          <a href="#landing-top" aria-label="回到首页开场" aria-current={active === 0 ? 'location' : undefined}><i /></a>
          <a href="#platform" aria-label="前往平台介绍" aria-current={active === 1 ? 'location' : undefined}><i /></a>
          <a href="#capabilities" aria-label="前往核心能力" aria-current={active >= 2 && active <= 6 ? 'location' : undefined}><i /></a>
          <a href="#landing-stories" aria-label="前往治理案例" aria-current={active === 7 ? 'location' : undefined}><i /></a>
        </div>
        <span>{String(Math.min(active + 1, 8)).padStart(2, '0')} / 08</span>
      </nav>
      <main>
        <section id="landing-top" className="landing-cinema-stage landing-opening" data-landing-stage aria-labelledby="hero-title">
          <div className="landing-cinema-viewport">
            <Landscape src="/landing/hero.webp" alt="薄雾中的高山与湖水，一名游客站在水边" priority />
            <div className="landing-cinema-frame landing-opening-frame">
              <p className="landing-scene-eyebrow landing-enter">W·CDC / WATER INTELLIGENCE</p>
              <h1 id="hero-title" className="landing-cinema-title landing-enter landing-enter-late"><span>看见水的</span><span>变化。</span></h1>
              <div className="landing-opening-bottom landing-enter landing-enter-later">
                <p>让监测数据、历史变化与专业依据，<br />成为保护水环境的线索。</p>
                <Link href="/login" className="landing-text-link">进入平台 <ArrowUpRight size={20} aria-hidden="true" /></Link>
              </div>
            </div>
            <a href="#platform" className="landing-cinema-next">向下，走进水的世界 <ArrowDown size={17} aria-hidden="true" /></a>
            <span className="landing-cinema-photo-note">自然摄影 · 主题意象</span>
          </div>
        </section>

        <section id="platform" className="landing-cinema-stage landing-platform" data-landing-stage aria-labelledby="platform-title">
          <div className="landing-cinema-viewport">
            <Landscape src="/landing/river.webp" alt="森林与清澈水流交汇的航拍自然景观" />
            <div className="landing-cinema-frame landing-platform-frame">
              <div className="landing-platform-heading">
                <p className="landing-scene-eyebrow landing-enter">01 / WHO WE ARE · 平台介绍</p>
                <h2 id="platform-title" className="landing-cinema-title landing-enter landing-enter-late"><span>水的变化，</span><span>不总在眼前。</span></h2>
              </div>
              <div className="landing-platform-aside landing-enter landing-enter-later">
                <span>FROM DATA TO UNDERSTANDING</span>
                <p>W·CDC 将工业园区的企业、排污口、污染物和历史记录连接起来。让分散的数据回到时间和位置之中，再追问异常从何而来。</p>
                <small>平台分析基于排污口监测记录；治理案例为独立的公众展示内容。</small>
              </div>
            </div>
            <span className="landing-cinema-photo-note">自然摄影 · 主题意象</span>
          </div>
        </section>

        <section id="capabilities" className="landing-cinema-stage landing-capability-intro" data-landing-stage aria-labelledby="capabilities-title">
          <div className="landing-cinema-viewport">
            <Landscape src="/landing/lake.webp" alt="蓝绿色山间湖泊的航拍自然景观" />
            <div className="landing-cinema-frame landing-intro-frame">
              <p className="landing-scene-eyebrow landing-enter">02 / WHAT WE DO · 核心能力</p>
              <h2 id="capabilities-title" className="landing-cinema-title landing-enter landing-enter-late"><span>从一条记录，</span><span>走向清楚的判断。</span></h2>
              <p className="landing-intro-caption landing-enter landing-enter-later">数据进入、历史对比、证据核查。四个连续的步骤，理解水环境的变化。</p>
            </div>
            <span className="landing-cinema-photo-note">自然摄影 · 主题意象</span>
          </div>
        </section>

        {abilities.map((ability) => (
          <section key={ability.number} id={'ability-' + ability.number} className="landing-cinema-stage landing-ability" data-landing-stage aria-labelledby={'ability-title-' + ability.number}>
            <div className="landing-cinema-viewport">
              <Landscape src={ability.image} alt={ability.alt} />
              <div className="landing-cinema-frame landing-ability-frame">
                <div className="landing-ability-heading">
                  <p className="landing-scene-eyebrow landing-enter">{ability.number} / 04 · {ability.eyebrow}</p>
                  <h3 id={'ability-title-' + ability.number} className="landing-cinema-title landing-enter landing-enter-late">{ability.title.map((line) => <span key={line}>{line}</span>)}</h3>
                </div>
                <div className="landing-ability-bottom landing-enter landing-enter-later"><strong>{ability.number}</strong><p>{ability.description}</p></div>
              </div>
              <span className="landing-cinema-photo-note">自然摄影 · 主题意象</span>
            </div>
          </section>
        ))}

        <section id="landing-stories" className="landing-cinema-stage landing-story-portal" data-landing-stage aria-labelledby="stories-teaser-title">
          <div className="landing-cinema-viewport">
            <Landscape src="/landing/desert.webp" alt="晨光下的沙漠沙丘自然景观，非治理案例现场" />
            <div className="landing-cinema-frame landing-story-frame">
              <p className="landing-scene-eyebrow landing-enter">03 / NEWS & STORIES · 治理案例</p>
              <h2 id="stories-teaser-title" className="landing-cinema-title landing-enter landing-enter-late"><span>看不见的地下水，</span><span>值得被看见。</span></h2>
              <div className="landing-story-bottom landing-enter landing-enter-later"><p>四个中国案例。去看发现、溯源与修复怎样发生。</p><Link href="/stories" className="landing-text-link">走进治理案例 <ArrowRight size={20} aria-hidden="true" /></Link></div>
            </div>
            <span className="landing-cinema-photo-note">自然摄影 · 非案例现场</span>
          </div>
        </section>

        <section className="landing-cinema-end" aria-label="开始使用">
          <p>W·CDC / WATER INTELLIGENCE</p>
          <h2>让每一份数据，<br /><span>成为保护水的开始。</span></h2>
          <Link href="/login">登录平台 <ArrowUpRight size={19} aria-hidden="true" /></Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
