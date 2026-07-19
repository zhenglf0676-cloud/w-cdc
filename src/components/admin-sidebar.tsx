'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Building2,
  Activity,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { title: '首页（园区地图）', href: '/admin', icon: LayoutDashboard },
  { title: '企业管理', href: '/admin/management', icon: Building2 },
  { title: '实时监测（预警中心）', href: '/admin/monitoring', icon: Activity },
  { title: '系统管理', href: '/admin/settings', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, session } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // 获取待审批数量
  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!session?.access_token) return;

      try {
        const response = await fetch('/api/admin/applications/pending-count', {
          headers: {
            'x-session': JSON.stringify(session),
          },
        });

        if (response.ok) {
          const data = await response.json();
          setPendingCount(data.count || 0);
        }
      } catch (error) {
        console.error('获取待审批数量失败:', error);
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000); // 每30秒刷新一次
    return () => clearInterval(interval);
  }, [session]);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col bg-[#0F2B46] text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-white/10 px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#0EA5E9]">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold">园区地下水环境监测平台</span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded bg-[#0EA5E9]">
            <Activity className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const showBadge = item.href === '/admin/management' && pendingCount > 0;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-[#0EA5E9] text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <div className="relative flex-shrink-0">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </div>
              {!collapsed && <span>{item.title}</span>}
            </button>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="border-t border-white/10 px-2 py-4">
        {!collapsed && user && (
          <div className="mb-3 px-3">
            <div className="text-sm font-medium">{user.user_metadata?.full_name || '管理员'}</div>
            <div className="text-xs text-white/50">{user.email}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>退出登录</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#0F2B46] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
