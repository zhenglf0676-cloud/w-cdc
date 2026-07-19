'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

export default function HomeRedirect() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, session } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // 未登录且加载完成，直接跳转登录页
    if (!isLoading && !isAuthenticated) {
      setRedirecting(true);
      router.replace('/login');
      return;
    }

    // 加载中，不处理
    if (isLoading) {
      return;
    }

    // 获取用户角色
    if (isAuthenticated && user && session) {
      fetch('/api/profiles/me', {
        headers: {
          'x-session': session.access_token,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setRole(data.data.role);
          }
        })
        .catch((err) => {
          console.error('获取用户信息失败:', err);
        });
    }
  }, [isLoading, isAuthenticated, user, session, router]);

  // 根据角色跳转
  useEffect(() => {
    if (role === 'admin') {
      setRedirecting(true);
      router.replace('/admin');
    } else if (role === 'enterprise') {
      setRedirecting(true);
      router.replace('/enterprise');
    }
  }, [role, router]);

  // 跳转中或加载中显示加载动画
  if (isLoading || (!redirecting && !role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0EA5E9]" />
      </div>
    );
  }

  return null;
}
