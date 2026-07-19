'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home,
  Radio,
  BarChart3,
  User,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useSupabaseConfig } from '@/lib/supabase-config-inject';
import { cn } from '@/lib/utils';

interface EnterpriseSidebarProps {
  activeItem?: string;
}

const menuItems = [
  { id: 'home', label: '首页（污染物管理）', icon: Home, href: '/enterprise' },
  { id: 'monitor', label: '排污点监测', icon: Radio, href: '/enterprise/monitor' },
  { id: 'cdc', label: 'CDC 分析', icon: BarChart3, href: '/enterprise/cdc' },
  { id: 'profile', label: '个人中心', icon: User, href: '/enterprise/profile' },
];

export function EnterpriseSidebar({ activeItem = 'home' }: EnterpriseSidebarProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isLoading, error } = useSupabaseConfig();
  const isReady = !isLoading && !error;
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!isReady) return;
    
    try {
      // 获取 session token
      const { getSupabaseBrowserClient } = await import('@/lib/supabase-browser');
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;
      
      const res = await fetch('/api/enterprise/notifications', {
        headers: {
          'x-session': session.access_token,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('获取未读消息数量失败:', error);
    }
  };

  // 获取未读消息数量
  useEffect(() => {
    if (!isReady) return;
    fetchUnreadCount();
    // 每 30 秒刷新一次
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [isReady]);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const companyName = user?.user_metadata?.company_name || '企业用户';

  return (
    <div
      className={cn(
        'fixed left-0 top-0 z-40 flex h-full flex-col bg-[#0F2B46] text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <Building2 className="h-6 w-6 shrink-0 text-sky-400" />
        {!collapsed && (
          <span className="text-sm font-semibold whitespace-nowrap">园区地下水环境监测平台</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          const showBadge = item.id === 'profile' && unreadCount > 0;
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="whitespace-nowrap flex-1 text-left">{item.label}</span>
                  {showBadge && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="border-t border-white/10 p-3">
        {!collapsed && (
          <div className="mb-3 flex items-center gap-2 rounded-md bg-white/5 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold">
              {companyName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{companyName}</p>
              <p className="truncate text-xs text-slate-400">企业用户</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-red-500/20 hover:text-red-400',
            collapsed && 'justify-center'
          )}
          title={collapsed ? '退出登录' : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>退出登录</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </div>
  );
}
