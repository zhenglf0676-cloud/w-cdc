import Link from 'next/link';
import { ArrowUpRight, Droplets } from 'lucide-react';

export function PublicHeader() {
  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Link href="/" className="public-brand" aria-label="W·CDC 首页">
          <span className="public-brand-mark"><Droplets size={22} strokeWidth={1.5} aria-hidden="true" /></span>
          <span>W·CDC <small>WATER INTELLIGENCE</small></span>
        </Link>
        <nav className="public-nav" aria-label="网站导航">
          <Link href="/#platform">平台介绍</Link>
          <Link href="/#capabilities">核心能力</Link>
          <Link href="/stories">NEWS <span>治理案例</span></Link>
        </nav>
        <Link href="/login" className="public-login">登录平台 <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div><strong>W·CDC</strong><p>基于虚拟质点系与高维矩张量耦合的水污染动态评估系统</p></div>
        <div className="public-footer-links"><Link href="/">首页</Link><Link href="/stories">治理案例</Link><Link href="/login">登录</Link><Link href="/register">注册</Link></div>
      </div>
      <div className="public-footer-bottom"><span>W·CDC · 守护水环境，从理解变化开始</span><a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">自然摄影素材：Unsplash <ArrowUpRight size={12} aria-hidden="true" /></a></div>
    </footer>
  );
}
