'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Droplets, Loader2 } from 'lucide-react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { useSupabaseConfig } from '@/lib/supabase-config-inject';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const APP_ICON_URL = 'https://coze-coding-project.tos.coze.site/gen_project_icon/2026-07-19/7664132817533763599_1784448963.png?sign=4906513018-895757e6df-0-736898d83ce3829565980b6ed3d392d92eb800346f56fde50229a2899b5a2cc6';
const APP_NAME = '地下水监测网站';

export default function LoginPage() {
  const router = useRouter();
  const { isLoading: isConfigLoading } = useSupabaseConfig();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码');
      return;
    }

    setIsLoading(true);
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError('邮箱或密码错误');
        return;
      }

      if (data.session) {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('登录失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (isConfigLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0EA5E9]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0F2B46] shadow-lg">
            {APP_ICON_URL ? (
              <Image
                src={APP_ICON_URL}
                alt={APP_NAME}
                width={48}
                height={48}
                className="rounded-xl object-contain"
              />
            ) : (
              <Droplets className="h-8 w-8 text-[#0EA5E9]" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">{APP_NAME}</h1>
          <p className="text-sm text-[#64748B]">地下水监测排污预警系统</p>
        </div>

        {/* Login Card */}
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-lg font-semibold text-[#0F172A]">欢迎回来</CardTitle>
            <CardDescription className="text-[#64748B]">
              登录您的账户以继续
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="rounded-md border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-[#0F172A]">
                  邮箱地址
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="请输入邮箱地址"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 border-[#E2E8F0] bg-white text-[#0F172A] placeholder:text-[#94A3B8]"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-[#0F172A]">
                  密码
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 border-[#E2E8F0] bg-white pr-10 text-[#0F172A] placeholder:text-[#94A3B8]"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-10 w-full bg-[#0EA5E9] text-white hover:bg-[#0284C7] disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>

              <div className="text-center text-sm text-[#64748B]">
                还没有账号？{' '}
                <Link
                  href="/register"
                  className="font-medium text-[#0EA5E9] hover:text-[#0284C7] hover:underline"
                >
                  去注册
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
