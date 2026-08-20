'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Droplets, Loader2, Shield, Factory, MapPin, Building2 } from 'lucide-react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { useSupabaseConfig } from '@/lib/supabase-config-inject';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LocationPicker } from '@/components/location-picker';

const APP_ICON_URL = 'https://coze-coding-project.tos.coze.site/gen_project_icon/2026-07-19/7664132817533763599_1784448963.png?sign=4906513018-895757e6df-0-736898d83ce3829565980b6ed3d392d92eb800346f56fde50229a2899b5a2cc6';
const APP_NAME = '基于虚拟质点系与高维矩张量耦合的水污染动态评估系统';

const highlights = [
  { label: '实时监测', desc: '7天周期数据采集与分析' },
  { label: 'CDC指数', desc: '多维度污染风险量化评估' },
  { label: '超标预警', desc: '自动触发分级预警通知' },
  { label: '地图可视化', desc: '园区排污口分布一目了然' },
];

type UserRole = 'admin' | 'enterprise' | '';

export default function RegisterPage() {
  const router = useRouter();
  const { isLoading: isConfigLoading } = useSupabaseConfig();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('');
  const [companyName, setCompanyName] = useState('');
  const [parkName, setParkName] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [locationAddress, setLocationAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('请填写账号名');
      return;
    }
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('请填写所有字段');
      return;
    }
    if (!role) {
      setError('请选择账户角色');
      return;
    }
    if (role === 'enterprise') {
      if (!companyName.trim()) {
        setError('使用者需要填写企业名称');
        return;
      }
      if (!parkName.trim()) {
        setError('请选择所属园区');
        return;
      }
      if (!locationConfirmed) {
        setError('请在地图上选择并确认企业位置');
        return;
      }
    }
    if (password.length < 6) {
      setError('密码长度至少为6位');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: role,
            company_name: role === 'enterprise' ? companyName.trim() : null,
            park_name: role === 'enterprise' ? parkName.trim() : null,
            latitude: role === 'enterprise' && location ? location.lat : null,
            longitude: role === 'enterprise' && location ? location.lng : null,
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('该邮箱已被注册');
        } else {
          setError(authError.message);
        }
        return;
      }

      if (data.user) {
        // Write profile to database via API route
        try {
          await fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: data.user.id,
              role: role,
              fullName: fullName.trim(),
              companyName: role === 'enterprise' ? companyName.trim() : null,
              parkName: role === 'enterprise' ? parkName.trim() : null,
              latitude: role === 'enterprise' && location ? location.lat : null,
              longitude: role === 'enterprise' && location ? location.lng : null,
            }),
          });
        } catch (profileError) {
          console.error('Failed to create profile:', profileError);
        }

        if (data.session) {
          router.push('/');
          router.refresh();
        } else {
          // Auto-confirm is on, try signing in directly
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (!signInError) {
            router.push('/');
            router.refresh();
          } else {
            router.push('/login');
          }
        }
      }
    } catch {
      setError('注册失败，请稍后重试');
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
    <div className="flex min-h-screen items-start justify-center bg-[#F8FAFC] px-4 py-8">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F2B46] shadow-lg">
            {APP_ICON_URL ? (
              <Image
                src={APP_ICON_URL}
                alt={APP_NAME}
                width={36}
                height={36}
                className="rounded-lg object-contain"
              />
            ) : (
              <Droplets className="h-6 w-6 text-[#0EA5E9]" />
            )}
          </div>
          <h1 className="text-lg font-bold tracking-tight text-[#0F172A]">{APP_NAME}</h1>
        </div>

        {/* Register Card */}
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-lg font-semibold text-[#0F172A]">创建账户</CardTitle>
            <CardDescription className="text-[#64748B]">
              注册新账户以开始使用
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="rounded-md border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]">
                  {error}
                </div>
              )}

              {/* Role Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#0F172A]">账户角色</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    disabled={isLoading}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all',
                      role === 'admin'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                        : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                    )}
                  >
                    <Shield className={cn(
                      'h-5 w-5',
                      role === 'admin' ? 'text-[#0EA5E9]' : 'text-[#94A3B8]'
                    )} />
                    <span className={cn(
                      'text-sm font-medium',
                      role === 'admin' ? 'text-[#0EA5E9]' : 'text-[#64748B]'
                    )}>
                      管理者
                    </span>
                    <span className="text-xs text-[#94A3B8]">园区管理</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('enterprise')}
                    disabled={isLoading}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all',
                      role === 'enterprise'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                        : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                    )}
                  >
                    <Factory className={cn(
                      'h-5 w-5',
                      role === 'enterprise' ? 'text-[#0EA5E9]' : 'text-[#94A3B8]'
                    )} />
                    <span className={cn(
                      'text-sm font-medium',
                      role === 'enterprise' ? 'text-[#0EA5E9]' : 'text-[#64748B]'
                    )}>
                      使用者
                    </span>
                    <span className="text-xs text-[#94A3B8]">企业用户</span>
                  </button>
                </div>
              </div>

              {/* Account Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium text-[#0F172A]">
                  账号名
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder={role === 'admin' ? '请输入园区名称（如：XX产业园区）' : '请输入您的姓名'}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-10 border-[#E2E8F0] bg-white text-[#0F172A] placeholder:text-[#94A3B8]"
                  autoComplete="name"
                  disabled={isLoading}
                />
                {role === 'admin' && (
                  <p className="text-xs text-[#94A3B8]">管理者账号名即为园区名称，企业注册时可选择所属园区</p>
                )}
              </div>

              {/* Email */}
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

              {/* Enterprise Fields */}
              {role === 'enterprise' && (
                <>
                  {/* Company Name */}
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-sm font-medium text-[#0F172A]">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-[#64748B]" />
                        所属企业
                      </span>
                    </Label>
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="请输入企业名称"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="h-10 border-[#E2E8F0] bg-white text-[#0F172A] placeholder:text-[#94A3B8]"
                      disabled={isLoading}
                    />
                  </div>

                  {/* Park Name */}
                  <div className="space-y-2">
                    <Label htmlFor="parkName" className="text-sm font-medium text-[#0F172A]">
                      所属园区
                    </Label>
                    <Input
                      id="parkName"
                      type="text"
                      placeholder="请输入所属园区名称"
                      value={parkName}
                      onChange={(e) => setParkName(e.target.value)}
                      className="h-10 border-[#E2E8F0] bg-white text-[#0F172A] placeholder:text-[#94A3B8]"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-[#94A3B8]">填写园区管理者注册的园区名称，用于关联管理</p>
                  </div>

                  {/* Location Picker */}
                  <LocationPicker
                    value={location ?? undefined}
                    onChange={(loc) => setLocation({ lat: loc.lat, lng: loc.lng })}
                    onConfirm={(loc: { lat: number; lng: number; address: string }) => {
                      setLocationConfirmed(true);
                      setLocationAddress(loc.address);
                    }}
                  />
                </>
              )}

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-[#0F172A]">
                  密码
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码（至少6位）"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 border-[#E2E8F0] bg-white pr-10 text-[#0F172A] placeholder:text-[#94A3B8]"
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-[#0F172A]">
                  确认密码
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="请再次输入密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-10 border-[#E2E8F0] bg-white pr-10 text-[#0F172A] placeholder:text-[#94A3B8]"
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    注册中...
                  </>
                ) : (
                  '注册'
                )}
              </Button>

              <div className="text-center text-sm text-[#64748B]">
                已有账号？{' '}
                <Link
                  href="/login"
                  className="font-medium text-[#0EA5E9] hover:text-[#0284C7] hover:underline"
                >
                  去登录
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
