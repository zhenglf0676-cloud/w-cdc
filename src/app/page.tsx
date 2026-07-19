'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

export default function HomeRedirect() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0EA5E9]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Dashboard />;
}

function Dashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-[#E2E8F0] bg-white px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F2B46]">
            <svg className="h-4 w-4 text-[#0EA5E9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-[#0F172A]">地下水监测网站</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#64748B]">{user?.email}</span>
          <button
            onClick={handleSignOut}
            className="rounded-md border border-[#E2E8F0] px-3 py-1.5 text-sm text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            退出登录
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0EA5E9]/10">
            <svg className="h-8 w-8 text-[#0EA5E9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-[#0F172A]">欢迎使用地下水监测系统</h2>
          <p className="text-sm text-[#64748B]">系统功能正在开发中，敬请期待...</p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <div className="mb-2 text-2xl font-bold text-[#0EA5E9]">--</div>
              <div className="text-sm text-[#64748B]">监测站点</div>
            </div>
            <div className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <div className="mb-2 text-2xl font-bold text-[#F59E0B]">--</div>
              <div className="text-sm text-[#64748B]">预警数量</div>
            </div>
            <div className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <div className="mb-2 text-2xl font-bold text-[#10B981]">--</div>
              <div className="text-sm text-[#64748B]">正常运行</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
