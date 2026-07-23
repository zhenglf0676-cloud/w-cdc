'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { Loader2, Droplets, MapPin, BarChart3, Bell, Shield, ArrowRight, Activity } from 'lucide-react';

const APP_ICON_URL = 'https://coze-coding-project.tos.coze.site/gen_project_icon/2026-07-19/7664132817533763599_1784448963.png?sign=4906513018-895757e6df-0-736898d83ce3829565980b6ed3d392d92eb800346f56fde50229a2899b5a2cc6';
const APP_NAME = '地下水监测排污预警系统';

const features = [
  {
    icon: MapPin,
    title: '园区地图总览',
    desc: '可视化展示园区企业分布与排污口位置，实时掌握全局态势',
  },
  {
    icon: BarChart3,
    title: 'CDC 污染分析',
    desc: '基于变异系数、偏斜度等多维统计，计算污染风险指数',
  },
  {
    icon: Bell,
    title: '超标预警',
    desc: '实时监测污染物浓度，超标自动预警，分级告警通知',
  },
  {
    icon: Shield,
    title: '排污审批管理',
    desc: '企业排污口申请、污染物配置、审批流程一站式管理',
  },
];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, session } = useAuth();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && user && session) {
      fetch('/api/profiles/me', {
        headers: { 'x-session': session.access_token },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setRole(data.data.role);
        })
        .catch(() => {});
    }
  }, [isLoading, isAuthenticated, user, session]);

  useEffect(() => {
    if (role === 'admin') {
      router.replace('/admin');
    } else if (role === 'enterprise') {
      router.replace('/enterprise');
    }
  }, [role, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F2B46]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0EA5E9]" />
      </div>
    );
  }

  // 已登录等待跳转
  if (isAuthenticated && role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F2B46]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0EA5E9]" />
      </div>
    );
  }

  // 未登录：展示介绍页
  return (
    <div className="relative min-h-screen bg-[#0F2B46] overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 opacity-[0.03]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#0EA5E9] opacity-[0.06] blur-3xl" />
      <div className="absolute -bottom-40 -left-32 h-[500px] w-[500px] rounded-full bg-[#0EA5E9] opacity-[0.04] blur-3xl" />

      {/* 顶部导航 */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 lg:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
            {APP_ICON_URL ? (
              <Image src={APP_ICON_URL} alt={APP_NAME} width={28} height={28} className="rounded-lg object-contain" />
            ) : (
              <Droplets className="h-5 w-5 text-[#0EA5E9]" />
            )}
          </div>
          <span className="text-base font-semibold text-white/80 tracking-wide">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-white/10 bg-white/[0.06] px-5 py-2 text-sm text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            登录
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-[#0EA5E9] px-5 py-2 text-sm font-medium text-white transition-all hover:bg-[#0284C7]"
          >
            注册
          </Link>
        </div>
      </header>

      {/* Hero 区域 */}
      <main className="relative z-10 flex flex-col items-center px-6 pt-16 pb-20 lg:pt-24">
        <div className="mb-3 flex items-center gap-2 rounded-full border border-[#0EA5E9]/20 bg-[#0EA5E9]/10 px-4 py-1.5">
          <Activity className="h-3.5 w-3.5 text-[#0EA5E9]" />
          <span className="text-xs text-[#0EA5E9]/80">工业园区环保监控平台</span>
        </div>

        <h1 className="mb-5 text-center text-4xl font-bold leading-tight text-white lg:text-5xl">
          智慧环保，守护地下<br />水资源安全
        </h1>
        <p className="mb-10 max-w-lg text-center text-base leading-relaxed text-white/40">
          面向工业园区的地下水监测与排污预警管理平台，融合多维统计分析、
          实时监测预警与可视化地图，助力环保部门与企业实现精准管控。
        </p>

        <div className="flex items-center gap-4">
          <Link
            href="/register"
            className="flex items-center gap-2 rounded-lg bg-[#0EA5E9] px-7 py-3 text-sm font-medium text-white transition-all hover:bg-[#0284C7]"
          >
            开始使用
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-7 py-3 text-sm text-white/70 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            已有账号，去登录
          </Link>
        </div>

        {/* 功能卡片 */}
        <div className="mt-20 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6 transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.1]"
            >
              <feature.icon className="h-6 w-6 text-[#0EA5E9] mb-4" />
              <h3 className="text-sm font-medium text-white/90 mb-2">{feature.title}</h3>
              <p className="text-xs leading-relaxed text-white/35">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* 数据指标 */}
        <div className="mt-16 flex items-center gap-10 border-t border-white/[0.06] pt-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">7</div>
            <div className="mt-1 text-xs text-white/30">天数据周期</div>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div className="text-center">
            <div className="text-2xl font-bold text-white">4</div>
            <div className="mt-1 text-xs text-white/30">类污染物监测</div>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div className="text-center">
            <div className="text-2xl font-bold text-[#0EA5E9]">CDC</div>
            <div className="mt-1 text-xs text-white/30">污染风险指数</div>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div className="text-center">
            <div className="text-2xl font-bold text-white">3</div>
            <div className="mt-1 text-xs text-white/30">级风险预警</div>
          </div>
        </div>
      </main>

      {/* 底部 */}
      <footer className="relative z-10 border-t border-white/[0.04] py-6 text-center text-xs text-white/15">
        地下水监测排污预警系统 &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
