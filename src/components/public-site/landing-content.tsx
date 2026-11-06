import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, BarChart3, FileSpreadsheet, MapPinned, Sparkles } from 'lucide-react';
import { PublicFooter, PublicHeader } from './chrome';
import '@/app/landing.css';

const capabilities = [
  { number: '01', icon: MapPinned, title: '看见每一个排污口', description: '把企业、排污口与监测记录放在同一张图上，追踪数据来自哪里。' },
  { number: '02', icon: BarChart3, title: '读懂长期的变化', description: '结合历史正常参考、波动指标与 CDC 分析，辨别值得关注的变化。' },
  { number: '03', icon: FileSpreadsheet, title: '让数据进入分析', description: '上传 Excel 后先预检，再按企业、排污口、污染物与日期录入监测数据。' },
  { number: '04', icon: Sparkles, title: '与小水滴一起求证', description: '结合授权数据与资料依据问答，查看分析过程、图表与报告。' },
];

export function LandingContent() {
  return (
    <div className="public-site">
      <PublicHeader />
      <main>
        <section className="landing-hero relative isolate flex min-h-[760px] flex-col justify-end overflow-hidden pb-24 pt-36 text-white md:min-h-[92svh] md:pb-28" aria-labelledby="hero-title">
          <Image src="/landing/hero.webp" alt="薄雾中的高山与湖水，一名游客站在水边" fill priority sizes="100vw" className="landing-hero-image object-cover object-center" />
          <div className="landing-hero-shade absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-[1480px] px-6 md:px-12 lg:px-16">
            <div className="landing-rise mb-7 flex items-center gap-3 text-[11px] font-semibold tracking-[0.3em] text-white/90 md:text-xs"><span className="h-px w-9 bg-white/75" /> WATER INTELLIGENCE / W·CDC</div>
            <h1 id="hero-title" className="landing-rise landing-rise-delay max-w-[1050px] text-[clamp(3.6rem,9.2vw,9.5rem)] font-semibold leading-[1.05] tracking-[-0.075em]">看见水的<span className="landing-hero-outline">变化。</span></h1>
            <div className="landing-rise landing-rise-later mt-8 flex max-w-3xl flex-col gap-8 md:mt-11 md:flex-row md:items-end md:justify-between">
              <p className="max-w-md text-base leading-8 text-white/90 md:text-lg">从排污口监测记录到历史波动分析，让每一条数据成为理解水环境的线索。</p>
              <Link href="/login" className="landing-pill inline-flex w-fit shrink-0 items-center gap-8 rounded-full bg-white px-6 py-4 text-sm font-semibold text-[#12333c] hover:bg-[#dff4ec] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">进入平台 <ArrowUpRight size={18} aria-hidden="true" /></Link>
            </div>
          </div>
          <div className="absolute bottom-7 left-6 hidden items-center gap-3 text-[11px] font-semibold tracking-[0.2em] text-white/80 md:left-12 md:flex lg:left-16"><ArrowDown size={15} aria-hidden="true" /> 向下探索</div>
          <span className="absolute bottom-7 right-6 text-[10px] tracking-widest text-white/80 md:right-12 lg:right-16">自然摄影 · 主题意象</span>
        </section>

        <section id="platform" className="scroll-mt-20 bg-[#f4f5f0] px-6 py-24 text-[#153a3e] md:px-12 md:py-36 lg:px-16" aria-labelledby="platform-title">
          <div className="mx-auto grid max-w-[1480px] gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(330px,0.65fr)] lg:gap-24">
            <div><p className="landing-kicker mb-9">01 / 平台介绍 <span>THE PLATFORM</span></p><h2 id="platform-title" className="max-w-4xl text-[clamp(2.7rem,5.6vw,6rem)] font-semibold leading-[1.22] tracking-[-0.065em]">水的变化不总是显而易见，<span className="text-[#6a8c84]">数据可以先一步发现。</span></h2></div>
            <div className="flex flex-col justify-end gap-8 border-t border-[#a9b9ae] pt-8 lg:pt-0"><span className="text-[11px] font-semibold tracking-[0.24em] text-[#568476]">FROM DATA TO UNDERSTANDING</span><p className="max-w-xl text-lg leading-9 text-[#486467]">W·CDC 面向工业园区的排污口监测与水环境分析。它连接企业、排污口、污染物和历史记录，通过可视化、统计分析与小水滴智能问答，帮助使用者有依据地发现异常、追问原因。</p><p className="text-sm leading-7 text-[#688080]">平台记录对应排污口数据；地下水治理案例用于公众展示，不代表平台已监测案例地点。</p></div>
          </div>
        </section>

        <section id="capabilities" className="scroll-mt-20 bg-[#12343b] px-6 py-24 text-white md:px-12 md:py-32 lg:px-16" aria-labelledby="capabilities-title">
          <div className="mx-auto max-w-[1480px]">
            <p className="landing-kicker landing-kicker-light mb-10">02 / 核心能力 <span>WHAT WE DO</span></p>
            <div className="mb-16 flex flex-col gap-5 md:mb-20 md:flex-row md:items-end md:justify-between"><h2 id="capabilities-title" className="max-w-3xl text-[clamp(2.8rem,5.5vw,6rem)] font-semibold leading-[1.15] tracking-[-0.065em]">把复杂的监测，<br />变成清楚的判断。</h2><p className="max-w-sm text-base leading-8 text-white/65">从数据进入、趋势理解到证据核查，每一步都能找到来处。</p></div>
            <div className="grid border-t border-white/25 md:grid-cols-2 lg:grid-cols-4">{capabilities.map((item) => <div key={item.number} className="landing-capability group flex min-h-[290px] flex-col border-b border-white/25 py-7 pr-8 md:min-h-[330px] lg:border-r lg:pl-7 first:pl-0 last:border-r-0"><span className="text-xs tracking-[0.2em] text-white/55">{item.number} / 04</span><item.icon className="mt-auto mb-7 h-7 w-7 stroke-[1.4] text-[#b1d7c5] transition-transform duration-500 group-hover:-translate-y-2" aria-hidden="true" /><h3 className="mb-3 text-2xl font-semibold tracking-[-0.04em]">{item.title}</h3><p className="max-w-xs text-sm leading-7 text-white/65">{item.description}</p></div>)}</div>
          </div>
        </section>

        <section className="bg-[#e3ede6] px-6 py-24 text-[#153a3e] md:px-12 md:py-36 lg:px-16" aria-labelledby="stories-teaser-title">
          <div className="mx-auto grid max-w-[1480px] items-center gap-12 lg:grid-cols-2 lg:gap-24">
            <div className="relative min-h-[400px] overflow-hidden md:min-h-[610px]"><Image src="/landing/river.webp" alt="森林与水流的航拍自然景观" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover transition-transform duration-[1200ms] hover:scale-[1.035]" /><span className="absolute bottom-5 left-5 bg-[#12343b]/80 px-3 py-2 text-[11px] tracking-widest text-white backdrop-blur-sm">自然摄影 · 非案例现场</span></div>
            <div><p className="landing-kicker mb-10">03 / 治理案例 <span>NEWS & STORIES</span></p><h2 id="stories-teaser-title" className="text-[clamp(2.7rem,5vw,5.6rem)] font-semibold leading-[1.2] tracking-[-0.065em]">看不见的地下水，<br />值得被看见。</h2><p className="mt-8 max-w-xl text-lg leading-9 text-[#4e6d6d]">地下水污染可能沿着地下通道迁移，也可能需要漫长的调查与修复。通过中国的真实案例，理解为什么源头预防、持续监测与协同治理缺一不可。</p><Link href="/stories" className="mt-12 inline-flex items-center gap-8 border-b border-[#153a3e] pb-3 text-sm font-semibold tracking-wide hover:text-[#4d8271] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#153a3e]">阅读治理案例 <ArrowRight size={18} aria-hidden="true" /></Link></div>
          </div>
        </section>

        <section className="bg-[#f4f5f0] px-6 py-24 text-center text-[#153a3e] md:py-32" aria-label="开始使用"><p className="text-xs font-semibold tracking-[0.3em] text-[#6b8b80]">W·CDC / WATER INTELLIGENCE</p><h2 className="mx-auto mt-7 max-w-4xl text-[clamp(2.6rem,6vw,6.5rem)] font-semibold leading-[1.15] tracking-[-0.07em]">让每一份数据，<br />成为保护水的开始。</h2><Link href="/login" className="mt-10 inline-flex items-center gap-8 rounded-full bg-[#153a3e] px-7 py-4 text-sm font-semibold text-white hover:bg-[#386d64] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#153a3e]">登录平台 <ArrowUpRight size={18} aria-hidden="true" /></Link></section>
      </main>
      <PublicFooter />
    </div>
  );
}
