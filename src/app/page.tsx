'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Activity, ArrowDown, ArrowRight, ArrowUpRight, Bell, Check, ChevronRight, Droplets, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PublicWaterScene } from '@/components/public-water-scene';

const APP_NAME = '基于虚拟质点系与高维矩张量耦合的水污染动态评估系统';
const sections = [{ id: 'home', label: '首页' }, { id: 'advantages', label: '系统优势' }, { id: 'stories', label: '水治理案例' }];
const advantages = [
  { label: '地图总览', brief: '在一张图上看清空间分布', eyebrow: '01 / 看见全局', icon: MapPin, image: '/visuals/river-overview.webp', title: '从园区地图，\n看清每一个排污点。', description: '将企业和排污口位置放在同一张地图上，帮助管理者了解园区分布与排污情况。', details: ['企业与排污口分布', '位置可视化', '管理视角'] },
  { label: '监测分析', brief: '让时间里的变化可被理解', eyebrow: '02 / 理解变化', icon: Activity, image: '/visuals/water-monitoring.webp', title: '让监测记录，\n成为可以理解的趋势。', description: '查看监测记录与历史曲线，并结合 CDC 分析了解水质变化和污染风险。', details: ['监测记录', '历史曲线', 'CDC 分析'] },
  { label: '审批协同', brief: '连接申请、处理与结果通知', eyebrow: '03 / 形成闭环', icon: ShieldCheck, image: '/visuals/waterside-workflow.webp', title: '让申请、审核与通知，\n都有清晰的去向。', description: '企业提交排污口及污染物申请，管理者进行审批，相关结果通过通知传达。', details: ['企业申请', '管理者审批', '结果通知'] },
];
const cases = [
  { number: '01', location: '重庆 · 长江流域', title: '入河排污口排查整治', description: '围绕入河排污口开展排查、监测、溯源与整治，让流域治理建立在清晰的底数之上。', source: '生态环境部 · 2022', href: 'https://www.mee.gov.cn/home/ztbd/2022/rhrhpwkjdgl/gzdtpwk/202205/t20220525_983431.shtml', image: '/visuals/case-chongqing.webp', tone: 'river' },
  { number: '02', location: '江苏 · 太湖流域', title: '流域监测与系统治理', description: '以排污口整治和水质监测网络为支撑，持续推进太湖流域综合治理。', source: '生态环境部 · 2023', href: 'https://www.mee.gov.cn/xxgk2018/xxgk/xxgk13/202311/t20231107_1055316.html', image: '/visuals/case-taihu.webp', tone: 'lake' },
  { number: '03', location: '广东 · 深圳', title: '茅洲河综合治理', description: '通过截污、治理与生态修复，推动曾经污染严重的河流逐步改善水质。', source: '生态环境部 · 2023', href: 'https://www.mee.gov.cn/home/ztbd/2023/mlhh2/yxal1/tmal/202310/t20231027_1044199.shtml', image: '/visuals/case-shenzhen.webp', tone: 'estuary' },
];

export default function Home() {
  const router = useRouter();
  const heroRef = useRef<HTMLElement>(null);
  const { isAuthenticated, isLoading, user, session } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('home');
  const [activeAdvantage, setActiveAdvantage] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && user && session) {
      fetch('/api/profiles/me', { headers: { 'x-session': session.access_token } })
        .then((res) => res.json())
        .then((data) => { if (data.success) setRole(data.data.role); })
        .catch(() => {});
    }
  }, [isLoading, isAuthenticated, user, session]);

  useEffect(() => {
    if (role === 'admin') router.replace('/admin');
    else if (role === 'enterprise') router.replace('/enterprise');
  }, [role, router]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: '-25% 0px -48% 0px', threshold: [0, 0.2, 0.5] });
    sections.forEach(({ id }) => { const element = document.getElementById(id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    let frame = 0;
    const updateDive = () => {
      frame = 0;
      const distance = Math.max(1, hero.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / distance));
      hero.style.setProperty('--sea-line', `${105 - progress * 110}%`);
      hero.style.setProperty('--dive-progress', progress.toString());
      hero.style.setProperty('--dive-exit', Math.min(1, Math.max(0, (progress - .48) / .52)).toString());
      hero.style.setProperty('--hero-copy-opacity', (1 - Math.min(1, Math.max(0, (progress - .12) / .65))).toString());
      hero.style.setProperty('--hero-offset', `${-progress * 32}px`);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(updateDive); };
    updateDive();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); if (frame) window.cancelAnimationFrame(frame); };
  }, [isLoading, isAuthenticated, role]);

  if (isLoading || (isAuthenticated && role)) return <div className="flex min-h-screen items-center justify-center bg-[#071b34]"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>;

  const feature = advantages[activeAdvantage];
  const FeatureIcon = feature.icon;
  return (
    <div className="public-site">
      <header className="public-header">
        <Link href="#home" className="public-brand" aria-label="水污染动态评估系统，返回首页"><span className="public-brand-mark"><Droplets size={22} /></span><span className="public-brand-name"><span className="public-brand-title">水域<span>·</span>洞察</span><small>WATER INTELLIGENCE</small></span></Link>
        <nav className="public-nav" aria-label="主导航">{sections.map(({ id, label }) => <a key={id} href={`#${id}`} className={activeSection === id ? 'is-active' : ''} aria-current={activeSection === id ? 'location' : undefined} onClick={() => setActiveSection(id)}>{label}</a>)}</nav>
        <div className="public-header-actions"><Link href="/login" className="public-header-login">登录</Link><Link href="/register" className="public-header-register">创建账号 <ArrowUpRight size={15} /></Link></div>
      </header>

      <main>
        <section id="home" ref={heroRef} className="public-hero" aria-labelledby="hero-title">
          <div className="public-hero-stage">
            <div className="public-sea-surface" aria-hidden="true" />
            <div className="public-underwater-window" aria-hidden="true"><PublicWaterScene /><span className="public-underwater-caustics" /></div>
            <div className="public-hero-shade" />
            <div className="public-hero-content">
              <div className="public-kicker"><span className="public-pulse" /> 为水而设计 · 工业园区水环境管理</div>
              <h1 id="hero-title">看见水的变化，<br /><em>预见更好的未来。</em></h1>
              <p>从排污口到监测数据，从风险分析到审批协同。<br />让每一份水环境信息都更清晰，让每一步管理都有迹可循。</p>
              <div className="public-hero-actions"><Link href="/login" className="public-button public-button-primary">进入系统 <ArrowUpRight size={18} /></Link><a href="#advantages" className="public-button public-button-ghost">探索系统 <ArrowDown size={17} /></a></div>
            </div>
            <div className="public-hero-bottom"><span>01 / 03&nbsp;&nbsp; 从海面，走向水下</span><span className="public-scroll-indicator"><span /> SCROLL TO DIVE</span></div>
            <div className="public-dive-marker" aria-hidden="true"><span>SEA LEVEL</span><span className="public-dive-marker-line" /><span>向下探索</span></div>
          </div>
        </section>

        <section id="advantages" className="public-advantages" aria-labelledby="advantages-title">
          <div className="public-section-head"><p className="public-section-label"><span>01</span> / THE PLATFORM</p><div><h2 id="advantages-title">让复杂的水环境管理，<br /><em>变得清晰可见。</em></h2><p>同一套系统，连接园区地图、监测分析与审批流程。</p></div></div>
          <div className="public-feature-shell">
            <div className="public-feature-tabs" role="tablist" aria-label="系统优势">{advantages.map((item, index) => { const Icon = item.icon; return <button key={item.label} id={`feature-tab-${index}`} type="button" role="tab" aria-selected={activeAdvantage === index} aria-controls="feature-panel" tabIndex={activeAdvantage === index ? 0 : -1} onClick={() => setActiveAdvantage(index)} onKeyDown={(event) => { if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return; event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : advantages.length - 1)) % advantages.length; setActiveAdvantage(next); document.getElementById(`feature-tab-${next}`)?.focus(); }} className={activeAdvantage === index ? 'is-active' : ''}><span className="public-tab-icon"><Icon size={18} /></span><span className="public-tab-copy"><small>0{index + 1} / 0{advantages.length}</small><strong>{item.label}</strong><span className="public-tab-brief">{item.brief}</span></span><span className="public-tab-thumb"><Image src={item.image} alt="" fill sizes="70px" /></span><ChevronRight size={17} className="public-tab-arrow" /></button>; })}</div>
            <div id="feature-panel" role="tabpanel" aria-labelledby={`feature-tab-${activeAdvantage}`} className="public-feature-panel" key={feature.label}>
              <div className="public-feature-copy"><div className="public-feature-eyebrow"><FeatureIcon size={15} /> {feature.eyebrow}</div><h3>{feature.title}</h3><p>{feature.description}</p><div className="public-feature-chips">{feature.details.map((detail) => <span key={detail}><Check size={13} />{detail}</span>)}</div></div>
              <div className={`public-feature-art public-feature-art-${activeAdvantage}`} aria-hidden="true">
                <Image src={feature.image} alt="" fill sizes="(max-width: 760px) 100vw, (max-width: 1100px) 65vw, 42vw" className="public-feature-image" />
                <span className="public-feature-image-wash" />
                {activeAdvantage === 0 && <><span className="public-map-pin pin-one"><MapPin size={19} fill="currentColor" /></span><span className="public-map-pin pin-two"><MapPin size={19} fill="currentColor" /></span><span className="public-map-pin pin-three"><MapPin size={19} fill="currentColor" /></span><span className="public-art-label map-label-one">园区区域</span><span className="public-art-label map-label-two">排污口位置</span><span className="public-art-floating"><MapPin size={14} /> 空间分布 / MAP VIEW</span></>}
                {activeAdvantage === 1 && <><div className="public-image-data"><span>WATER / OBSERVATION</span><svg className="public-chart" viewBox="0 0 420 110" preserveAspectRatio="none"><path d="M 0 85 C 50 83, 55 35, 112 63 S 182 89, 228 32 S 296 61, 338 22 S 387 50, 420 11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg><small>变化趋势 · 概念示意</small></div><span className="public-art-floating"><Activity size={14} /> 监测趋势 / ANALYSIS</span></>}
                {activeAdvantage === 2 && <><div className="public-approval-card card-back"><span>01</span><strong>提交申请</strong><small>企业端</small></div><div className="public-approval-card card-middle"><span>02</span><strong>审批处理</strong><small>管理者端</small></div><div className="public-approval-card card-front"><span className="approval-check"><Check size={16} /></span><strong>结果通知</strong><small>流程清晰可追踪</small></div><span className="public-art-floating"><Bell size={14} /> 协同流程 / WORKFLOW</span></>}
              </div>
            </div>
          </div>
          <p className="public-feature-note">页面图片与叠加图形用于介绍功能，不展示真实监测数据。</p>
        </section>

        <section id="stories" className="public-stories" aria-labelledby="stories-title">
          <div className="public-story-halo" aria-hidden="true" />
          <div className="public-section-head public-section-head-dark"><p className="public-section-label"><span>02</span> / WATER STORIES</p><div><h2 id="stories-title">中国水治理，<br /><em>正在发生的改变。</em></h2><p>从流域到城市，看看真实的治理实践。以下案例为独立公开报道，与本系统的项目成果无关联。配图为视觉示意，并非案例现场照片。</p></div></div>
          <div className="public-case-grid">{cases.map((item) => <a key={item.number} href={item.href} target="_blank" rel="noopener noreferrer" className={`public-case public-case-${item.tone}`}><div className="public-case-art" aria-hidden="true"><Image src={item.image} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" className="public-case-image" /></div><div className="public-case-top"><span>{item.number} / 03</span><ArrowUpRight size={18} /></div><div className="public-case-content"><span className="public-case-location">{item.location}</span><h3>{item.title}</h3><p>{item.description}</p><small>阅读官方案例 · {item.source}</small></div></a>)}</div>
          <div className="public-ending"><div><p>水的故事，值得继续书写。</p><h2>从了解开始，<em>走向行动。</em></h2></div><Link href="/login" className="public-button public-button-primary">进入系统 <ArrowRight size={18} /></Link></div>
        </section>
      </main>
      <footer className="public-footer"><span><Droplets size={18} /> 水域·洞察</span><small>{APP_NAME}</small><a href="#home">回到顶部 ↑</a></footer>
    </div>
  );
}
