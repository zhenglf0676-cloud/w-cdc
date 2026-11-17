'use client';

import { usePathname } from 'next/navigation';
import { EnterpriseSidebar } from '@/components/enterprise-sidebar';
import { FloatingWorkbenchNav } from '@/components/floating-workbench-nav';

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 根据当前路由路径确定激活的菜单项
  let activeItem = 'home';
  if (pathname === '/enterprise/monitoring') {
    activeItem = 'monitor';
  } else if (pathname === '/enterprise/cdc') {
    activeItem = 'cdc';
  } else if (pathname === '/enterprise/knowledge') {
    activeItem = 'knowledge';
  } else if (pathname === '/enterprise/profile') {
    activeItem = 'profile';
  }

  return (
    <div className="workbench-shell min-h-screen bg-slate-50">
      <EnterpriseSidebar activeItem={activeItem} />
      <div className="workbench-main min-w-0">
        <FloatingWorkbenchNav role="enterprise" />
        {children}
      </div>
    </div>
  );
}
