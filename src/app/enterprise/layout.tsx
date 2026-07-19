'use client';

import { EnterpriseSidebar } from '@/components/enterprise-sidebar';

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <EnterpriseSidebar activeItem="home" />
      <div className="ml-64">{children}</div>
    </div>
  );
}
