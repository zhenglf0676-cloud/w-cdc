'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

export default function HomeRedirect() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
      return;
    }

    // 获取用户角色
    if (isAuthenticated && user) {
      fetch('/api/profiles/me')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setRole(data.data.role);
          }
        });
    }
  }, [isLoading, isAuthenticated, user, router]);

  // 根据角色跳转
  useEffect(() => {
    if (role === 'admin') {
      router.replace('/admin');
    } else if (role === 'enterprise') {
      router.replace('/enterprise');
    }
  }, [role, router]);

  if (isLoading || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0EA5E9]" />
      </div>
    );
  }

  return null;
}
