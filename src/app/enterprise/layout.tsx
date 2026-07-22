'use client';

import { usePathname } from 'next/navigation';
import { EnterpriseSidebar } from '@/components/enterprise-sidebar';

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 根据当前路由路径确定激活的菜单项
  let activeItem = 'home';
  if (pathname === '/enterprise/monitoring') {
    activeItem = 'monitor';
  } else if (pathname === '/enterprise/cdc') {
    activeItem = 'cdc';
  } else if (pathname === '/enterprise/profile') {
    activeItem = 'profile';
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <EnterpriseSidebar activeItem={activeItem} />
      <div className="ml-64">{children}</div>
    </div>
  );
}
