import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/public-site/chrome';
import '../landing.css';

export const metadata: Metadata = {
  title: '治理案例 · 地下水保护',
  description: '从中国的地下水污染治理与溯源案例出发，理解源头预防、持续监测与协同治理的重要性。',
};

const cases = [
  {
    id: '01', location: '贵州 · 凯里', topic: '饮用水安全', year: '2024 年报道',
    title: '龙洞泉：让水源重新可用',
    body: '面对地下水水源风险，当地采取“源头减量＋过程控制＋末端阻隔＋应急管控”的治理思路。生态环境部介绍，水质实现根本性改善，解决了附近 2000 余人的饮水问题。',
    lesson: '治理启示 / 从源头到末端，完整控制污染路径。',
    source: '生态环境部 · 2024 年 7 月例行新闻发布会',
    url: 'https://www.mee.gov.cn/ywdt/xwfb/202407/t20240729_1082870.shtml',
    image: '/landing/river.webp', alt: '森林与水流的自然航拍景观，非案例现场照片',
  },
  {
    id: '02', location: '四川 · 广元', topic: '废弃矿井', year: '2023 年报道',
    title: '废弃矿井：看见水下的旧问题',
    body: '废弃矿井的酸性废水不能只靠末端处理。生态环境部介绍，四川广元等试点取得积极成效，形成矿井酸性废水“堵疏治管”等经验，推动源头治理与长效监管。',
    lesson: '治理启示 / 废弃之后，也需要持续管控与监测。',
    source: '生态环境部 · 关于矿山地下水污染防治的提案答复',
    url: 'https://www.mee.gov.cn/xxgk2018/xxgk/xxgk13/202311/t20231103_1054995.html',
    image: '/landing/lake.webp', alt: '山谷中的湖泊航拍景观，非案例现场照片',
  },
  {
    id: '03', location: '宁夏 · 中卫', topic: '污染修复', year: '2018 年通报',
    title: '腾格里沙漠：修复不是一日之功',
    body: '工业园区污染事件后，当地推进污水处理设施改造与地下水抽提修复。2017 年阶段评估显示，部分修复区域的上层水质有明显好转、污染范围缩小；后续仍需跟踪修复效果。',
    lesson: '治理启示 / 从整改到长期评估，修复需要时间。',
    source: '生态环境部 · 宁夏腾格里沙漠环境污染问题整改通报',
    url: 'https://www.mee.gov.cn/gkml/sthjbgw/qt/201802/W020180208359695380065.pdf',
    image: '/landing/desert.webp', alt: '沙漠沙丘的自然摄影，非腾格里案例现场照片',
  },
  {
    id: '04', location: '四川 · 筠连', topic: '跨省溯源', year: '2020 年报道',
    title: '玉壶井：沿地下河寻找源头',
    body: '玉壶井水质恶化后，调查人员结合排查、同位素分析与示踪实验，追查跨省地下河的污染来源。该案例说明，污染物可能在看不见的地下通道中迁移，治理首先需要查清路径。',
    lesson: '治理启示 / 发现异常只是起点，溯源需要证据。',
    source: '生态环境部 · 四川首例跨省环保民事公益诉讼案报道',
    url: 'https://www.mee.gov.cn/ywdt/dfnews/202008/t20200824_794840.shtml',
    image: '/landing/hero.webp', alt: '山间湖泊的自然摄影，非玉壶井案例现场照片',
  },
];

export default function StoriesPage() {
  return (
    <div className="public-site">
      <PublicHeader />
      <main>
        <section className="stories-hero relative isolate flex min-h-[680px] flex-col justify-end overflow-hidden px-6 pb-20 pt-36 text-white md:min-h-[82svh] md:px-12 md:pb-28 lg:px-16" aria-labelledby="stories-title">
          <Image src="/landing/river.webp" alt="森林与水流的自然航拍景观" fill priority sizes="100vw" className="landing-hero-image object-cover" />
          <div className="stories-hero-shade absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-[1480px]"><p className="landing-rise mb-8 text-xs font-semibold tracking-[0.3em] text-white/85">W·CDC / NEWS & STORIES</p><h1 id="stories-title" className="landing-rise landing-rise-delay max-w-[1050px] text-[clamp(3.3rem,8vw,8.5rem)] font-semibold leading-[1.08] tracking-[-0.075em]">让地下的故事，<br />回到地面。</h1><div className="landing-rise landing-rise-later mt-9 flex max-w-3xl flex-col gap-8 md:flex-row md:items-end md:justify-between"><p className="max-w-lg text-base leading-8 text-white/90 md:text-lg">四个中国案例，记录水源风险、污染溯源与修复行动。水在地下流动，保护不能停留在看得见的地方。</p><a href="#cases" className="inline-flex w-fit items-center gap-3 border-b border-white pb-2 text-sm font-semibold">探索案例 <ArrowDown size={17} aria-hidden="true" /></a></div></div>
          <span className="absolute bottom-6 right-6 text-[10px] tracking-widest text-white/80 md:right-12 lg:right-16">自然摄影 · 非案例现场</span>
        </section>

        <section className="bg-[#f4f5f0] px-6 py-24 text-[#153a3e] md:px-12 md:py-32 lg:px-16" aria-labelledby="stories-intro-title"><div className="mx-auto grid max-w-[1480px] gap-12 lg:grid-cols-[0.85fr_1fr] lg:gap-24"><p className="landing-kicker">01 / 为什么要保护 <span>WHY IT MATTERS</span></p><div><h2 id="stories-intro-title" className="text-[clamp(2.5rem,4.5vw,5rem)] font-semibold leading-[1.25] tracking-[-0.065em]">污染一旦进入地下，<br />发现、溯源和修复<br />都需要更久。</h2><p className="mt-8 max-w-2xl text-lg leading-9 text-[#4e6d6d]">地下水保护关乎饮水安全、粮食安全与生态安全。公开案例提醒我们：先阻止污染发生，发现异常后查清来源，再把治理与长期监测接起来。</p><a className="mt-8 inline-flex items-center gap-2 border-b border-[#527a71] pb-1 text-sm text-[#3e7168]" href="https://www.mee.gov.cn/ywdt/xwfb/202407/t20240729_1082870.shtml" target="_blank" rel="noopener noreferrer">依据：生态环境部 2024 年新闻发布会 <ArrowUpRight size={15} aria-hidden="true" /></a></div></div></section>

        <section id="cases" className="scroll-mt-20 bg-[#e3ede6] px-6 py-24 text-[#153a3e] md:px-12 md:py-32 lg:px-16" aria-labelledby="case-list-title"><div className="mx-auto max-w-[1480px]"><div className="mb-14 flex flex-col justify-between gap-6 md:mb-20 md:flex-row md:items-end"><div><p className="landing-kicker mb-8">02 / 中国治理实践 <span>CASE NOTES</span></p><h2 id="case-list-title" className="text-[clamp(2.8rem,5.5vw,6rem)] font-semibold leading-[1.15] tracking-[-0.065em]">四种现场，<br />同一个方向。</h2></div><p className="max-w-sm text-sm leading-7 text-[#5e7773]">内容基于公开官方资料整理。每条均可打开原始报道核对；配图仅作自然主题意象。</p></div>
          <div className="grid gap-x-8 gap-y-20 md:grid-cols-2">{cases.map((item) => <article key={item.id} className="stories-case group"><div className="stories-case-image relative mb-7 aspect-[1.25] overflow-hidden"><Image src={item.image} alt={item.alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-[900ms] group-hover:scale-[1.045]" /><span className="absolute bottom-4 left-4 bg-[#12343b]/85 px-3 py-2 text-[10px] tracking-wide text-white backdrop-blur-sm">主题摄影 · 非案例现场</span></div><div className="mb-5 flex items-center justify-between gap-3 border-t border-[#9cb2a5] pt-5 text-xs font-semibold tracking-wider text-[#5c7a71]"><span>{item.id} / {item.location}</span><span>{item.topic} · {item.year}</span></div><h3 className="text-[clamp(1.9rem,2.7vw,3.2rem)] font-semibold leading-[1.3] tracking-[-0.05em]">{item.title}</h3><p className="mt-5 max-w-[660px] text-base leading-8 text-[#4b6867]">{item.body}</p><p className="mt-6 border-l-2 border-[#5a9a7c] pl-4 text-sm font-medium leading-7 text-[#335b52]">{item.lesson}</p><a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-3 border-b border-[#245649] pb-2 text-sm font-semibold transition-colors hover:text-[#638e79] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#153a3e]">查看原始资料 <ArrowUpRight size={17} aria-hidden="true" /></a><p className="mt-3 text-xs leading-6 text-[#68807a]">{item.source}</p></article>)}</div></div></section>

        <section className="bg-[#12343b] px-6 py-24 text-white md:px-12 md:py-32 lg:px-16" aria-label="从案例到行动"><div className="mx-auto flex max-w-[1480px] flex-col items-start justify-between gap-12 lg:flex-row lg:items-end"><div><p className="landing-kicker landing-kicker-light mb-9">03 / 从案例到行动 <span>WHAT COMES NEXT</span></p><h2 className="max-w-5xl text-[clamp(2.8rem,5.6vw,6.2rem)] font-semibold leading-[1.17] tracking-[-0.06em]">保护地下水，<br />从认真对待每一次变化开始。</h2></div><Link href="/" className="inline-flex shrink-0 items-center gap-7 rounded-full bg-white px-7 py-4 text-sm font-semibold text-[#12343b] hover:bg-[#dff4ec]">了解 W·CDC <ArrowRight size={18} aria-hidden="true" /></Link></div></section>
      </main>
      <PublicFooter />
    </div>
  );
}
