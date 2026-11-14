'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';
import { LandingContent } from '@/components/public-site/landing-content';

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
  return <LandingContent />;
}
