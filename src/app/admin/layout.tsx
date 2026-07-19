'use client';

import { useAuth } from '@/lib/auth-context';
import { AdminSidebar } from '@/components/admin-sidebar';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!session && !redirecting) {
      setRedirecting(true);
      router.push('/login');
    }
  }, [session, isLoading, redirecting, router]);

  if (isLoading || redirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="flex-1 ml-64">
        {children}
      </div>
    </div>
  );
}
