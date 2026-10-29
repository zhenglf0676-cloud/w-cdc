'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Check, CircleAlert, FileText, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { assistantFetch } from '@/lib/water-assistant/request';
import { useAuth } from '@/lib/auth-context';

type DocumentRow = {
  id: string; title: string; version: string; visibility: 'public' | 'park' | 'enterprise';
  status: 'pending' | 'published' | 'rejected' | 'archived'; file_name: string;
  embedding_status: 'keyword' | 'hybrid'; review_note: string | null; created_at: string; uploaded_by: string;
};
type Preview = { document: DocumentRow & { content: string; source_url: string | null }; chunks: { ordinal: number; section: string; content: string }[] };

const statuses: Record<DocumentRow['status'], string> = { pending: '待审核', published: '已发布', rejected: '未通过', archived: '已归档' };
const scopeLabels = { public: '公共资料', park: '所属园区', enterprise: '本企业' };

export function KnowledgeLibrary({ admin }: { admin: boolean }) {
  const { session, isLoading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'park'>('park');
  const [sourceUrl, setSourceUrl] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [text, setText] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const canManagePreview = !!preview && admin && (preview.document.visibility !== 'public' || preview.document.uploaded_by === session?.user.id);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await assistantFetch(token => fetch('/api/assistant/knowledge', { headers: { 'x-auth-token': token }, cache: 'no-store' }));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '资料列表读取失败');
      setDocuments(data.documents);
    } catch (err) { setError(err instanceof Error ? err.message : '资料列表读取失败'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (authLoading) return;
    if (session) void load();
    else { setDocuments([]); setPreview(null); setLoading(false); }
  }, [authLoading, session, load]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const form = new FormData();
      form.set('title', title); form.set('version', version);
      form.set('visibility', admin ? visibility : 'enterprise');
      form.set('sourceUrl', sourceUrl); form.set('validFrom', validFrom); form.set('validUntil', validUntil);
      if (file) form.set('file', file); else form.set('text', text);
      const response = await assistantFetch(token => fetch('/api/assistant/knowledge', { method: 'POST', headers: { 'x-auth-token': token }, body: form }));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '资料提交失败');
      setNotice(`${data.note} · 提取 ${data.chunkCount} 个片段`);
      setTitle(''); setVersion(''); setSourceUrl(''); setText(''); setValidFrom(''); setValidUntil(''); setFile(null);
      if (input.current) input.current.value = '';
      await load();
      await inspect(data.id);
    } catch (err) { setError(err instanceof Error ? err.message : '资料提交失败'); }
    finally { setBusy(false); }
  }

  async function inspect(id: string) {
    setError('');
    try {
      const response = await assistantFetch(token => fetch(`/api/assistant/knowledge?id=${encodeURIComponent(id)}`, { headers: { 'x-auth-token': token }, cache: 'no-store' }));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '资料预览失败');
      setPreview(data); setReviewNote('');
    } catch (err) { setError(err instanceof Error ? err.message : '资料预览失败'); }
  }

  async function review(id: string, action: 'approve' | 'reject' | 'archive' | 'reindex') {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await assistantFetch(token => fetch('/api/assistant/knowledge', { method: 'PATCH', headers: { 'x-auth-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, note: action === 'reject' ? reviewNote : undefined }) }));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '审核失败');
      setNotice(data.note || (action === 'approve' ? '资料已发布，小水滴现在可以检索' : action === 'reject' ? '已退回资料' : action === 'reindex' ? '语义索引已更新' : '资料已归档，不再参与检索'));
      setPreview(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : '审核失败'); }
    finally { setBusy(false); }
  }

  if (!session) return <main className="mx-auto max-w-6xl space-y-4 px-5 py-8 sm:px-8">
    <h1 className="text-2xl font-bold text-slate-900">小水滴资料库</h1>
    <p className="text-sm text-slate-600">{authLoading ? '正在验证登录状态…' : '请先登录，再查看和提交资料。'}</p>
    {!authLoading && <Button asChild><Link href="/login">去登录</Link></Button>}
  </main>;

  return <main className="mx-auto max-w-6xl space-y-7 px-5 py-8 sm:px-8">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-teal-100 p-3 text-teal-700"><BookOpen className="size-6" /></span><div>
      <h1 className="text-2xl font-bold text-slate-900">小水滴资料库</h1>
      <p className="mt-1 text-sm text-slate-600">{admin ? '审核企业资料，维护园区和公共知识；发布后小水滴才可引用。' : '查看已发布的公共及园区资料，提交本企业资料供管理员审核。'}</p>
    </div></div>
    {error && <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><CircleAlert className="size-4" />{error}</p>}
    {notice && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><Check className="size-4" />{notice}</p>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form onSubmit={upload} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">提交资料</h2>
        <div><Label htmlFor="knowledge-title">资料标题</Label><Input id="knowledge-title" required maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：1号排口采样与质控说明" className="mt-1.5" /></div>
        <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="knowledge-version">版本</Label><Input id="knowledge-version" maxLength={60} value={version} onChange={e => setVersion(e.target.value)} placeholder="例如：2026-10" className="mt-1.5" /></div>
          {admin && <div><Label htmlFor="knowledge-scope">适用范围</Label><select id="knowledge-scope" value={visibility} onChange={e => setVisibility(e.target.value as 'public' | 'park')} className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"><option value="park">所属园区</option><option value="public">公共资料</option></select></div>}</div>
        <div><Label htmlFor="knowledge-url">来源链接（可选）</Label><Input id="knowledge-url" type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." className="mt-1.5" /></div>
        <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="knowledge-from">生效日期（可选）</Label><Input id="knowledge-from" type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="mt-1.5" /></div><div><Label htmlFor="knowledge-until">失效日期（可选）</Label><Input id="knowledge-until" type="date" min={validFrom || undefined} value={validUntil} onChange={e => setValidUntil(e.target.value)} className="mt-1.5" /></div></div>
        <div><Label htmlFor="knowledge-file">文件</Label><Input ref={input} id="knowledge-file" type="file" accept=".pdf,.docx,.txt,.md" onChange={e => setFile(e.target.files?.[0] ?? null)} className="mt-1.5" /><p className="mt-1 text-xs text-slate-500">支持 PDF、DOCX、TXT、MD，最大 4MB；扫描图片需后续识别。</p></div>
        <div><Label htmlFor="knowledge-text">或粘贴文字</Label><Textarea id="knowledge-text" value={text} onChange={e => setText(e.target.value)} disabled={!!file} rows={5} placeholder="可以直接录入已核对的规则或操作说明，至少 30 字" className="mt-1.5" /></div>
        <Button type="submit" disabled={busy || !title.trim() || !file && text.trim().length < 30} className="w-full bg-teal-700 hover:bg-teal-800">{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{busy ? '正在处理…' : '提取并提交审核'}</Button>
      </form>
      <section className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="已提交资料">
        <div className="flex items-center justify-between gap-2"><h2 className="font-semibold text-slate-900">资料清单</h2><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>刷新</Button></div>
        {loading && <p className="text-sm text-slate-500">正在读取资料…</p>}
        {!loading && !documents.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">当前暂无可查看的资料。</p>}
        {documents.map(doc => <div key={doc.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-3">
          <div className="flex min-w-0 gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-teal-700" /><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-900">{doc.title}</p><p className="mt-1 text-xs text-slate-600">{scopeLabels[doc.visibility]} · {doc.version} · {statuses[doc.status]}{doc.status === 'published' && ` · ${doc.embedding_status === 'hybrid' ? '混合检索' : '关键词检索'}`}</p>{doc.review_note && <p className="mt-1 text-xs text-amber-700">审核意见：{doc.review_note}</p>}</div></div>
          <Button variant="outline" size="sm" onClick={() => void inspect(doc.id)}>预览</Button>
        </div>)}
      </section>
    </div>
    {preview && <section className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50/50 p-5" aria-label="资料提取预览">
      <div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold text-teal-950">资料片段 · {preview.document.title}</h2><p className="mt-1 text-xs text-slate-600">{preview.chunks.length} 个片段；问答引用将指向对应章节或页码。待审核资料需核对原文后才能发布。</p></div><Button variant="ghost" size="icon" onClick={() => setPreview(null)} aria-label="关闭预览"><X className="size-4" /></Button></div>
      <div className="max-h-80 space-y-2 overflow-y-auto">{preview.chunks.map(chunk => <div key={chunk.ordinal} className="rounded-lg bg-white p-3 text-xs leading-6 text-slate-700"><p className="mb-1 font-bold text-teal-800">{chunk.section} · 片段 {chunk.ordinal + 1}</p>{chunk.content}</div>)}</div>
      {canManagePreview && preview.document.status === 'pending' && <div className="space-y-2"><Label htmlFor="knowledge-review-note">退回原因（退回时填写）</Label><Textarea id="knowledge-review-note" maxLength={500} rows={2} value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="请说明需要修改的内容" /><div className="flex gap-2"><Button disabled={busy} onClick={() => void review(preview.document.id, 'approve')} className="bg-teal-700 hover:bg-teal-800">审核并发布</Button><Button disabled={busy || !reviewNote.trim()} variant="outline" onClick={() => void review(preview.document.id, 'reject')}>退回资料</Button></div></div>}
      {canManagePreview && preview.document.status === 'published' && <div className="flex gap-2"><Button disabled={busy} variant="outline" onClick={() => void review(preview.document.id, 'reindex')}>更新语义索引</Button><Button disabled={busy} variant="outline" onClick={() => void review(preview.document.id, 'archive')}>归档旧版本</Button></div>}
    </section>}
  </main>;
}
