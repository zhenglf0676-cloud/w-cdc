'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Droplets, Eye, EyeOff, Loader2 } from 'lucide-react';
import { PublicWaterScene } from '@/components/public-water-scene';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { useSupabaseConfig } from '@/lib/supabase-config-inject';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const APP_NAME = '基于虚拟质点系与高维矩张量耦合的水污染动态评估系统';

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
      <div className="flex min-h-screen items-center justify-center bg-[#0F2B46]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0EA5E9]" />
      </div>
    );
  }

  return (
    <main className="public-auth public-login">
      <section className="public-auth-visual" aria-label="水环境主题视觉">
        <PublicWaterScene />
        <div className="public-auth-visual-shade" />
        <Link href="/" className="public-auth-brand"><span className="public-brand-mark"><Droplets size={22} /></span><span>水域<span className="public-brand-dot">·</span>洞察</span></Link>
        <div className="public-auth-message"><span className="public-auth-index">01 / THE JOURNEY</span><h1>读懂水的脉络，<br /><em>从这里开始。</em></h1><p>让数据变得可见，让管理更有方向。</p></div>
        <div className="public-auth-caption">WATER INTELLIGENCE <span>—</span> 以水为始，向未来延伸</div>
      </section>
      <section className="public-auth-form-side">
        <div className="public-auth-top"><Link href="/" className="public-auth-back"><ArrowLeft size={16} /> 返回首页</Link><span>还没有账号？ <Link href="/register">立即注册 <ArrowRight size={14} /></Link></span></div>
        <div className="public-auth-card">
          <div className="public-auth-kicker"><span /> 欢迎回来 / WELCOME BACK</div>
          <h2>登录系统</h2>
          <p className="public-auth-intro">使用您的账号，继续探索水环境的每一处变化。</p>
          <form onSubmit={handleLogin} className="public-auth-form">
            {error && <div role="alert" className="public-auth-error">{error}</div>}
            <div className="public-field"><Label htmlFor="email">邮箱地址</Label><Input id="email" type="email" placeholder="请输入邮箱地址" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={isLoading} /></div>
            <div className="public-field"><Label htmlFor="password">密码</Label><div className="public-password"><Input id="password" type={showPassword ? 'text' : 'password'} placeholder="请输入密码" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={isLoading} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            <Button type="submit" className="public-auth-submit" disabled={isLoading}>{isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> 登录中...</> : <>登录 <ArrowRight size={18} /></>}</Button>
          </form>
          <div className="public-auth-divider"><span>水环境管理，从清晰开始</span></div>
          <div className="public-auth-foot">企业用户可<Link href="/register">创建账号</Link>；管理者使用已有账号登录。</div>
        </div>
        <p className="public-auth-system-name">{APP_NAME}</p>
      </section>
    </main>
  );
}
