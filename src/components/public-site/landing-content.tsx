'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { PublicFooter, PublicHeader } from './chrome';
import '@/app/landing.css';
import '@/app/landing-cinema.css';

const scenes = [
  { id:'landing-top', image:'snow', name:'雪山 · 起源', en:'01 / THE ORIGIN', title:['一滴水，','万千联系。'], description:'从雪山融化的那一刻起，水的旅程便与你我相连。', next:'沿着一滴水，向下探索' },
  { id:'platform', image:'canyon', name:'峡谷 · 相遇', en:'02 / THE PASSAGE', title:['穿过峡谷，','连接彼此。'], description:'水流连接山川，也连接生产与生活。W·CDC 将企业、排污口和监测记录联系起来，让每一次变化都有迹可循。', next:'平台介绍 / 从水的联系，看见数据的联系' },
  { id:'capabilities', image:'river', name:'河流 · 变化', en:'03 / THE CURRENT', title:['流动之间，','读懂变化。'], description:'一条读数，是一个时刻。把它放回时间的长河，才能看清变化。', next:'核心能力 / 定位 · 录入 · 对比' },
  { id:'underground', image:'soil', name:'地下 · 求证', en:'04 / BENEATH THE SURFACE', title:['深入地下，','追问答案。'], description:'看不见，不意味着不重要。让小水滴结合监测数据、历史对比与资料依据，把疑问转化为有证据的分析。', next:'智能分析 / 检索资料 · 核查证据 · 导出报告' },
  { id:'landing-stories', image:'ocean', name:'大海 · 守护', en:'05 / ONE SHARED WATER', title:['终归大海，','守护始于此。'], description:'每一处水源，都关系着更远的地方。从中国地下水治理案例中，看见保护与修复的意义。', next:'NEWS & STORIES / 地下水保护的中国实践' },
];
const WaterWorld3D=dynamic(()=>import('./water-world-3d').then((m)=>m.WaterWorld3D),{ssr:false});

export function LandingContent(){
  const [active,setActive]=useState(0);
  useEffect(()=>{
    const sections=Array.from(document.querySelectorAll<HTMLElement>('[data-landing-stage]'));
    let frame=0;
    const update=()=>{
      let current=0;
      sections.forEach((el,index)=>{if(el.getBoundingClientRect().top<window.innerHeight*.38)current=index;});
      setActive(current);
      sections.forEach((el,index)=>{el.dataset.active=String(index===current);});
      frame=0;
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
    update();window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
  },[]);
  return <div className="public-site landing-world">
    <PublicHeader />
    <div className="landing-unified-scene" aria-hidden="true">
      <div className="landing-scene-gallery">{scenes.map((scene,index)=><div key={scene.id} className="landing-scene-photo" data-visible={active===index}><Image src={'/landing/journey/'+scene.image+'.webp'} alt="" fill priority={index===0} sizes="100vw" className="object-cover" /></div>)}</div>
      <WaterWorld3D />
      <div className="landing-scene-shade" />
    </div>
    <nav className="landing-chapter-rail" aria-label="水的旅程">
      <span className="landing-rail-name">A JOURNEY OF WATER</span>
      <div>{scenes.map((scene,index)=><a key={scene.id} href={'#'+scene.id} aria-label={scene.name} aria-current={active===index?'location':undefined}><i /></a>)}</div>
      <span>{String(active+1).padStart(2,'0')} / 05</span>
    </nav>
    <main>
      {scenes.map((scene,index)=><section key={scene.id} id={scene.id} className={'landing-cinema-stage journey-stage journey-'+scene.image} data-landing-stage aria-labelledby={scene.id+'-title'}>
        <div className="landing-cinema-viewport">
          <div className="landing-cinema-frame journey-frame">
            <p className="landing-scene-eyebrow landing-enter">{scene.en} <span>{scene.name}</span></p>
            {index===0?<h1 id={scene.id+'-title'} className="landing-cinema-title landing-enter landing-enter-late">{scene.title.map((line)=><span key={line}>{line}</span>)}</h1>:<h2 id={scene.id+'-title'} className="landing-cinema-title landing-enter landing-enter-late">{scene.title.map((line)=><span key={line}>{line}</span>)}</h2>}
            <p className="journey-description landing-enter landing-enter-later">{scene.description}</p>
            {index===2&&<div className="journey-capabilities landing-enter landing-enter-later"><span><b>01</b> 定位排污口</span><span><b>02</b> Excel 智能录入</span><span><b>03</b> 历史趋势与 CDC</span></div>}
            {index===3&&<p className="journey-context landing-enter">平台分析基于授权范围内的排污口记录；画面为水循环主题意象，不代表污染迁移预测。</p>}
            {(index===0||index===4)&&<Link href={index===0?'/login':'/stories'} className="landing-text-link journey-link landing-enter landing-enter-later">{index===0?'进入 W·CDC':'走进治理案例'}<ArrowUpRight size={18} aria-hidden="true" /></Link>}
          </div>
          <div className="journey-caption"><span>{scene.next}</span>{index<4&&<a href={'#'+scenes[index+1].id} aria-label={'继续前往'+scenes[index+1].name}><ArrowDown size={18} /></a>}</div>
        </div>
      </section>)}
      <section className="landing-cinema-end" aria-label="开始使用"><p>EVERY DROP MATTERS</p><h2>让每一份数据，<br /><span>成为保护水的开始。</span></h2><Link href="/login">登录平台 <ArrowUpRight size={19} aria-hidden="true" /></Link><small className="journey-art-credit">景观为 AI 生成的水循环主题艺术画面，非真实监测点或治理案例现场。</small></section>
    </main>
    <PublicFooter />
  </div>;
}
