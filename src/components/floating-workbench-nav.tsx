'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Activity, BarChart3, Bell, Building2, Home, UserRound } from 'lucide-react';
import type { PointerEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Role = 'admin' | 'enterprise';

const links = {
  admin: [
    { href: '/admin', label: '园区概览', icon: Home },
    { href: '/admin/management', label: '审批管理', icon: Building2 },
    { href: '/admin/monitoring', label: '实时监测', icon: Activity },
  ],
  enterprise: [
    { href: '/enterprise', label: '企业首页', icon: Home },
    { href: '/enterprise/monitoring', label: '排污点监测', icon: Activity },
    { href: '/enterprise/cdc', label: 'CDC 分析', icon: BarChart3 },
  ],
};

function MagneticLink({ children, href, className, label }: {
  children: ReactNode;
  href: string;
  className?: string;
  label: string;
}) {
  const onMove = (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--magnet-x', `${(event.clientX - rect.left - rect.width / 2) * .12}px`);
    event.currentTarget.style.setProperty('--magnet-y', `${(event.clientY - rect.top - rect.height / 2) * .16}px`);
  };
  const onLeave = (event: PointerEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.setProperty('--magnet-x', '0px');
    event.currentTarget.style.setProperty('--magnet-y', '0px');
  };
  return <Link href={href} aria-label={label} onPointerMove={onMove} onPointerLeave={onLeave} className={cn('wb-magnetic', className)}>{children}</Link>;
}

export function FloatingWorkbenchNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const inbox = role === 'admin' ? '/admin/management' : '/enterprise/profile';
  const inboxLabel = role === 'admin' ? '查看审批' : '查看通知';
  return (
    <header className="wb-floating-nav" aria-label="工作台快捷导航">
      <Link className="wb-floating-brand" href={role === 'admin' ? '/admin' : '/enterprise'} aria-label="返回工作台首页">
        <span className="wb-liquid-mark" aria-hidden="true" />
        <span>WATER <strong>CDC</strong></span>
      </Link>
      <nav className="wb-floating-links" aria-label="常用页面">
        {links[role].map(({ href, label, icon: Icon }) => (
          <MagneticLink key={href} href={href} label={label} className={cn('wb-floating-link', pathname === href && 'is-active')}>
            <Icon size={17} aria-hidden="true" /><span>{label}</span>
          </MagneticLink>
        ))}
      </nav>
      <div className="wb-floating-actions">
        <MagneticLink href={inbox} label={inboxLabel} className="wb-floating-action">
          {role === 'admin' ? <Building2 size={18} aria-hidden="true" /> : <Bell size={18} aria-hidden="true" />}
        </MagneticLink>
        <MagneticLink href={role === 'admin' ? '/admin' : '/enterprise/profile'} label="工作台账户" className="wb-floating-avatar">
          <UserRound size={18} aria-hidden="true" />
        </MagneticLink>
      </div>
    </header>
  );
}
