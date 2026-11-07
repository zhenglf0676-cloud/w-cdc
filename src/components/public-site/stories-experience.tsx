'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, Plus } from 'lucide-react';
import { PublicFooter, PublicHeader } from './chrome';
import '@/app/landing.css';
import '@/app/stories-motion.css';

type Story = {
  id: string;
  place: string;
  theme: string;
  headline: string;
  statement: string;
  signal: string;
  signalLabel: string;
  detailTitle: string;
  detail: string;
  lesson: string;
  source: string;
  url: string;
  image: string;
  imageAlt: string;
};

const stories: Story[] = [
  {
    id: '01', place: '贵州 · 凯里', theme: '饮用水安全', headline: '守住一口泉。',
    statement: '水源的改善，关系着真实的日常生活。', signal: '2000+', signalLabel: '附近居民的饮水问题得到解决',
    detailTitle: '龙洞泉 · 从源头到末端',
    detail: '面对地下水水源风险，当地采取“源头减量＋过程控制＋末端阻隔＋应急管控”的治理思路。生态环境部介绍，水质实现根本性改善，解决了附近 2000 余人的饮水问题。',
    lesson: '保护水源，需要沿污染路径进行完整的控制。',
    source: '生态环境部 · 2024 年 7 月例行新闻发布会',
    url: 'https://www.mee.gov.cn/ywdt/xwfb/202407/t20240729_1082870.shtml',
    image: '/landing/river.webp', imageAlt: '森林与水流的航拍自然景观，非案例现场照片',
  },
  {
    id: '02', place: '四川 · 广元', theme: '废弃矿井', headline: '离开矿井，\n污染并未退场。',
    statement: '看不见的渗流，仍需要被长期关注。', signal: '堵 · 疏 · 治 · 管', signalLabel: '废弃矿井酸性废水治理实践',
    detailTitle: '广元 · 废弃矿井治理试点',
    detail: '废弃矿井的酸性废水不能只靠末端处理。生态环境部介绍，四川广元等试点取得积极成效，形成矿井酸性废水“堵疏治管”等经验，推动源头治理与长效监管。',
    lesson: '矿井废弃之后，污染风险不会自动消失。',
    source: '生态环境部 · 关于矿山地下水污染防治的提案答复',
    url: 'https://www.mee.gov.cn/xxgk2018/xxgk/xxgk13/202311/t20231103_1054995.html',
    image: '/landing/lake.webp', imageAlt: '山谷与湖泊的航拍自然景观，非案例现场照片',
  },
  {
    id: '03', place: '宁夏 · 中卫', theme: '污染修复', headline: '修复，\n不是一日之功。',
    statement: '阻断污染之后，还要持续观察水的回应。', signal: '持续修复', signalLabel: '阶段评估与后续跟踪',
    detailTitle: '腾格里沙漠 · 长期修复',
    detail: '工业园区污染事件后，当地推进污水处理设施改造与地下水抽提修复。2017 年阶段评估显示，部分修复区域的上层水质有明显好转、污染范围缩小；后续仍需跟踪修复效果。',
    lesson: '阶段性好转不是终点，修复需要长期评估。',
    source: '生态环境部 · 宁夏腾格里沙漠环境污染问题整改通报',
    url: 'https://www.mee.gov.cn/gkml/sthjbgw/qt/201802/W020180208359695380065.pdf',
    image: '/landing/desert.webp', imageAlt: '沙漠沙丘的自然摄影，非腾格里案例现场照片',
  },
  {
    id: '04', place: '四川 · 筠连', theme: '跨省溯源', headline: '沿地下河，\n寻找源头。',
    statement: '水流走过的路，也可能越过行政边界。', signal: '跨省溯源', signalLabel: '同位素分析与示踪实验',
    detailTitle: '玉壶井 · 追问污染从何而来',
    detail: '玉壶井水质恶化后，调查人员结合排查、同位素分析与示踪实验，追查跨省地下河的污染来源。该案例说明，污染物可能在看不见的地下通道中迁移，治理首先需要查清路径。',
    lesson: '发现异常只是起点，溯源需要证据。',
    source: '生态环境部 · 四川首例跨省环保民事公益诉讼案报道',
    url: 'https://www.mee.gov.cn/ywdt/dfnews/202008/t20200824_794840.shtml',
    image: '/landing/karst.webp', imageAlt: '喀斯特山地与河流的自然摄影，非玉壶井案例现场照片',
  },
];

function useStoryMotion() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const stages = Array.from(document.querySelectorAll<HTMLElement>('[data-story-stage]'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previousActive = -1;

    const update = () => {
      const viewport = window.innerHeight;
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      stages.forEach((stage, index) => {
        const rect = stage.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - viewport / 2);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = index;
        }
        if (!reducedMotion.matches) {
          const progress = Math.max(0, Math.min(1, (viewport - rect.top) / (viewport + rect.height)));
          stage.style.setProperty('--photo-shift', `${Math.round((progress - 0.5) * 100)}px`);
          stage.style.setProperty('--photo-scale', (1.16 - progress * 0.12).toFixed(3));
          stage.style.setProperty('--type-shift', `${Math.round((0.5 - progress) * 50)}px`);
          stage.style.setProperty('--ring-turn', `${Math.round(progress * 70)}deg`);
        }
      });

      stages.forEach((stage, index) => {
        const value = index === nearest ? 'true' : 'false';
        if (stage.dataset.active !== value) stage.dataset.active = value;
      });

      if (previousActive !== nearest) {
        previousActive = nearest;
        setActiveStage(nearest);
      }
      frame = 0;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reducedMotion.addEventListener('change', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reducedMotion.removeEventListener('change', schedule);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return activeStage;
}

function WaterOrbit() {
  return (
    <div className="story-orbit" aria-hidden="true">
      <div className="story-orbit-glow" />
      <div className="story-orbit-ring story-orbit-ring-one" />
      <div className="story-orbit-ring story-orbit-ring-two" />
      <div className="story-orbit-ring story-orbit-ring-three" />
      <div className="story-orbit-core" />
    </div>
  );
}

export function StoriesExperience() {
  const activeStage = useStoryMotion();

  return (
    <div className="public-site story-world">
      <PublicHeader />
      <nav className="story-rail" aria-label="案例章节">
        <span>W·CDC / STORIES</span>
        <div className="story-rail-links">
          {stories.map((story, index) => (
            <a key={story.id} href={`#chapter-${story.id}`} aria-label={`前往${story.place}案例`} aria-current={activeStage === index + 1 ? 'location' : undefined}>
              <span className="story-rail-dot" /><span className="story-rail-label">{story.id}</span>
            </a>
          ))}
        </div>
        <span>{String(Math.max(1, activeStage)).padStart(2, '0')} / 04</span>
      </nav>
      <main>
        <section className="story-stage story-prologue" data-story-stage aria-labelledby="stories-title">
          <div className="story-sticky">
            <div className="story-photo"><Image src="/landing/hero.webp" alt="薄雾中的山间湖泊与水边人物" fill priority sizes="100vw" className="object-cover" /></div>
            <div className="story-gradient story-gradient-prologue" aria-hidden="true" />
            <WaterOrbit />
            <div className="story-frame">
              <p className="story-eyebrow story-enter">W·CDC / NEWS & STORIES</p>
              <h1 id="stories-title" className="story-display story-enter story-enter-late"><span>地下水，</span><span>并不沉默。</span></h1>
              <p className="story-lead story-enter story-enter-later">四个中国案例。四段关于发现、溯源与修复的真实故事。</p>
            </div>
            <a className="story-scroll-cue" href="#chapter-01">向下，走进水的故事 <ArrowDown size={17} aria-hidden="true" /></a>
            <p className="story-photo-note">自然摄影 · 主题意象，非案例现场</p>
          </div>
        </section>

        {stories.map((story) => (
          <section id={`chapter-${story.id}`} key={story.id} className="story-stage story-chapter" data-story-stage aria-labelledby={`chapter-title-${story.id}`}>
            <div className="story-sticky">
              <div className="story-photo"><Image src={story.image} alt={story.imageAlt} fill sizes="100vw" className="object-cover" /></div>
              <div className="story-gradient" aria-hidden="true" />
              <WaterOrbit />
              <span className="story-ghost-number" aria-hidden="true">{story.id}</span>
              <div className="story-frame story-chapter-frame">
                <div className="story-heading-group">
                  <p className="story-eyebrow story-enter">CHAPTER {story.id} / {story.place} · {story.theme}</p>
                  <h2 id={`chapter-title-${story.id}`} className="story-display story-enter story-enter-late">{story.headline.split('\n').map((line) => <span key={line}>{line}</span>)}</h2>
                  <p className="story-lead story-enter story-enter-later">{story.statement}</p>
                </div>
                <div className="story-scene-foot story-enter story-enter-later">
                  <div className="story-signal"><strong>{story.signal}</strong><span>{story.signalLabel}</span></div>
                  <details className="story-detail">
                    <summary>走近这个案例 <Plus size={18} aria-hidden="true" /></summary>
                    <div className="story-detail-panel">
                      <p className="story-detail-kicker">{story.place} / {story.theme}</p>
                      <h3>{story.detailTitle}</h3>
                      <p>{story.detail}</p>
                      <p className="story-detail-lesson">{story.lesson}</p>
                      <a href={story.url} target="_blank" rel="noopener noreferrer">查看官方资料 <ArrowUpRight size={16} aria-hidden="true" /></a>
                      <small>{story.source}</small>
                    </div>
                  </details>
                </div>
              </div>
              <p className="story-photo-note">自然摄影 · 非案例现场</p>
            </div>
          </section>
        ))}

        <section className="story-epilogue" aria-labelledby="story-end-title">
          <p className="story-epilogue-kicker">FROM THE GROUND UP / 从发现到守护</p>
          <h2 id="story-end-title">水在地下流动。<br /><span>守护，从地面开始。</span></h2>
          <p>源头预防、监测变化、查清路径，才有可能把治理真正做下去。</p>
          <div className="story-end-links"><Link href="/">了解 W·CDC <ArrowRight size={18} aria-hidden="true" /></Link><a href="https://www.mee.gov.cn/ywdt/xwfb/202407/t20240729_1082870.shtml" target="_blank" rel="noopener noreferrer">了解地下水保护 <ArrowUpRight size={18} aria-hidden="true" /></a></div>
          <small>内容依据公开官方资料。摄影素材只用于表达自然景观，不代表案例现场；平台排污口记录不等于这些地点的地下水监测数据。</small>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
