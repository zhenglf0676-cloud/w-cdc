import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { SupabaseConfigProvider } from '@/lib/supabase-config-inject';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '地下水监测网站',
    template: '%s | 地下水监测',
  },
  description: '地下水监测排污预警系统 - 实时监控、智能预警、科学管理',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        <SupabaseConfigProvider>
          <AuthProvider>
            {isDev && <Inspector />}
            {children}
          </AuthProvider>
        </SupabaseConfigProvider>
      </body>
    </html>
  );
}
