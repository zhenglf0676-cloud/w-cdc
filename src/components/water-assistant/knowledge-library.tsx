'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Check, CircleAlert, FileText, Loader2, Plus, RefreshCw, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { assistantFetch } from '@/lib/water-assistant/request';
import type { KnowledgeSource } from '@/lib/water-assistant/knowledge';
import { useAuth } from '@/lib/auth-context';

type DocumentRow = {
  id: string; title: string; version: string; visibility: 'public' | 'park' | 'enterprise';
  status: 'pending' | 'published' | 'rejected' | 'archived'; file_name: string;
  embedding_status: 'keyword' | 'hybrid'; review_note: string | null; created_at: string; uploaded_by: string;
};
type Preview = { document: DocumentRow & { content: string; source_url: string | null }; chunks: { ordinal: number; section: string; content: string }[] };

const statuses: Record<DocumentRow['status'], string> = { pending: '待审核', published: '已发布', rejected: '未通过', archived: '已归档' };
const scopeLabels = { public: '公共资料', park: '历史园区资料（仅管理员）', enterprise: '本企业' };

export function KnowledgeLibrary({ admin }: { admin: boolean }) {
  const { session, isLoading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeSource[]>([]);
  const [searchScope, setSearchScope] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
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
  const searchRequest = useRef(0);
  const canManagePreview = !!preview && admin;

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

  function clearSearch() {
    searchRequest.current++;
    setQuery(''); setResults([]); setHasSearched(false); setSearching(false); setSearchError('');
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2 || term.length > 120) { setSearchError('请输入 2 至 120 字的检索问题'); return; }
    const requestId = ++searchRequest.current;
    setSearching(true); setSearchError(''); setHasSearched(false);
    try {
      const response = await assistantFetch(token => fetch('/api/assistant/knowledge/search', {
        method: 'POST', headers: { 'x-auth-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: term }),
      }));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '资料检索失败');
      if (requestId !== searchRequest.current) return;
      setResults(data.sources); setSearchScope(data.scope); setHasSearched(true);
    } catch (err) { if (requestId === searchRequest.current) setSearchError(err instanceof Error ? err.message : '资料检索失败'); }
    finally { if (requestId === searchRequest.current) setSearching(false); }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const form = new FormData();
      form.set('title', title); form.set('version', version);
      form.set('sourceUrl', sourceUrl); form.set('validFrom', validFrom); form.set('validUntil', validUntil);
      if (file) form.set('file', file); else form.set('text', text);
      const response = await assistantFetch(token => fetch('/api/assistant/knowledge', { method: 'POST', headers: { 'x-auth-token': token }, body: form }));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '资料提交失败');
      setNotice(`${data.note} · 提取 ${data.chunkCount} 个片段`);
      setTitle(''); setVersion(''); setSourceUrl(''); setText(''); setValidFrom(''); setValidUntil(''); setFile(null);
      if (input.current) input.current.value = '';
      setUploadOpen(false);
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
      clearSearch();
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : '审核失败'); }
    finally { setBusy(false); }
  }

  if (!session) return <main className="mx-auto max-w-5xl space-y-4 px-5 py-8 sm:px-8">
    <h1 className="text-2xl font-bold text-slate-900">小水滴资料库</h1>
    <p className="text-sm text-slate-600">{authLoading ? '正在验证登录状态…' : '请先登录，再查看和提交资料。'}</p>
    {!authLoading && <Button asChild><Link href="/login">去登录</Link></Button>}
  </main>;

  return <main className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-slate-900">小水滴资料库</h1>
        <p className="mt-1 text-sm text-slate-500">{admin ? '查看和审核全部企业资料；上传的资料向所有企业公开。' : '检索公共资料与本企业资料，提交内容供管理员审核。'}</p>
      </div>
      <Button onClick={() => { setError(''); setUploadOpen(true); }} className="bg-teal-700 hover:bg-teal-800"><Plus className="size-4" />上传资料</Button>
    </div>

    {error && !uploadOpen && !preview && <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><CircleAlert className="size-4 shrink-0" />{error}</p>}
    {notice && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><Check className="size-4 shrink-0" />{notice}</p>}

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="资料检索">
      <Label htmlFor="knowledge-search" className="mb-3 block text-sm font-semibold text-slate-800">检索已发布资料</Label>
      <form onSubmit={search} className="flex flex-wrap gap-2 sm:flex-nowrap">
        <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
          <Search className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
          <Input id="knowledge-search" value={query} maxLength={120} onChange={event => { searchRequest.current++; setQuery(event.target.value); setHasSearched(false); setSearching(false); setSearchError(''); }} placeholder="例如：GB/T 14848 能用于排污口判定吗？" className="h-11 min-w-0 border-0 px-1 shadow-none focus-visible:ring-0" />
        </div>
        <Button type="submit" disabled={searching || query.trim().length < 2} className="h-11 bg-teal-700 px-5 hover:bg-teal-800">{searching && <Loader2 className="size-4 animate-spin" />}{searching ? '检索中…' : '检索'}</Button>
      </form>
      <p className="mt-2 text-xs text-slate-500">输入问题或关键词，查看匹配的原文片段；需要分析监测数据时请使用小水滴对话。</p>
      {searchError && <p role="alert" className="mt-3 text-sm text-red-700">{searchError}</p>}
    </section>

    {hasSearched ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="检索结果">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-4 sm:px-5"><h2 className="font-semibold text-slate-900">相关片段 <span className="ml-1 text-sm font-normal text-slate-500">{results.length} · {searchScope}</span></h2><Button variant="ghost" size="sm" onClick={clearSearch}>返回资料清单</Button></div>
      {!results.length && <p className="px-5 py-10 text-center text-sm text-slate-500">当前可访问的已发布资料中没有匹配片段，可以换个说法再试。</p>}
      {results.map(source => <article key={source.id} className="border-b border-slate-100 px-4 py-4 last:border-b-0 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-slate-900">{source.title}</h3><p className="mt-1 text-xs text-slate-500">{source.section} · {source.version}</p></div>
          {source.documentId && <Button variant="ghost" size="sm" onClick={() => void inspect(source.documentId!)}>查看资料</Button>}
        </div>
        <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{source.excerpt}</p>
        {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-teal-700 underline underline-offset-2">查看来源</a>}
      </article>)}
    </section> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="资料清单">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"><h2 className="font-semibold text-slate-900">资料清单 <span className="ml-1 text-sm font-normal text-slate-500">{loading ? '…' : documents.length}</span></h2><Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="text-slate-600"><RefreshCw className="size-4" />刷新</Button></div>
      {loading && <p className="px-5 py-8 text-sm text-slate-500">正在读取资料…</p>}
      {!loading && !documents.length && <p className="px-5 py-10 text-center text-sm text-slate-500">暂无可查看的资料，点击“上传资料”添加第一份。</p>}
      {!loading && documents.map(doc => <div key={doc.id} className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3"><FileText className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" /><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-900">{doc.title}</p><p className="mt-1 text-xs text-slate-500">{scopeLabels[doc.visibility]} · {doc.version} · {statuses[doc.status]}{doc.status === 'published' && ` · ${doc.embedding_status === 'hybrid' ? '混合检索' : '关键词检索'}`}</p>{doc.review_note && <p className="mt-1 text-xs text-amber-700">审核意见：{doc.review_note}</p>}</div></div>
        <div className="flex shrink-0 gap-1 pl-8 sm:pl-0"><Button variant="ghost" size="sm" onClick={() => void inspect(doc.id)}>{admin && doc.status === 'pending' ? '审核' : '查看'}</Button>
          {admin && doc.status === 'published' && doc.embedding_status === 'keyword' && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void review(doc.id, 'reindex')} className="text-teal-700 hover:text-teal-800">更新索引</Button>}
        </div>
      </div>)}
    </section>}

    <Dialog open={uploadOpen} onOpenChange={open => { if (!busy) setUploadOpen(open); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>上传资料</DialogTitle><DialogDescription>{admin ? '管理员上传的资料将公开给所有企业；核对并发布后进入检索。' : '上传的资料只供本企业与管理员查看；审核发布后才进入检索。'}</DialogDescription></DialogHeader>
        {error && <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><CircleAlert className="size-4 shrink-0" />{error}</p>}
        <form onSubmit={upload} className="space-y-4">
          <div><Label htmlFor="knowledge-title">资料标题</Label><Input id="knowledge-title" required maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：1号排口采样与质控说明" className="mt-1.5" /></div>
          <div><Label htmlFor="knowledge-file">选择文件</Label><Input ref={input} id="knowledge-file" type="file" accept=".pdf,.docx,.txt,.md" onChange={e => setFile(e.target.files?.[0] ?? null)} className="mt-1.5" /><p className="mt-1 text-xs text-slate-500">PDF、DOCX、TXT、MD，最大 4MB；扫描图片暂不支持。</p></div>
          <div><Label htmlFor="knowledge-text">或粘贴文字</Label><Textarea id="knowledge-text" value={text} onChange={e => setText(e.target.value)} disabled={!!file} rows={4} placeholder="可直接录入已核对的规则或操作说明，至少 30 字" className="mt-1.5" /></div>
          <details className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"><summary className="cursor-pointer font-medium">补充信息（可选）</summary><div className="mt-4 space-y-4">
            <div><Label htmlFor="knowledge-version">版本</Label><Input id="knowledge-version" maxLength={60} value={version} onChange={e => setVersion(e.target.value)} placeholder="例如：2026-10，默认 1.0" className="mt-1.5" /></div>
            <div><Label htmlFor="knowledge-url">来源链接</Label><Input id="knowledge-url" type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." className="mt-1.5" /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="knowledge-from">生效日期</Label><Input id="knowledge-from" type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="mt-1.5" /></div><div><Label htmlFor="knowledge-until">失效日期</Label><Input id="knowledge-until" type="date" min={validFrom || undefined} value={validUntil} onChange={e => setValidUntil(e.target.value)} className="mt-1.5" /></div></div>
          </div></details>
          <Button type="submit" disabled={busy || !title.trim() || (!file && text.trim().length < 30)} className="w-full bg-teal-700 hover:bg-teal-800">{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{busy ? '正在处理…' : '提取并提交审核'}</Button>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={!!preview} onOpenChange={open => { if (!open && !busy) setPreview(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle className="pr-5 leading-snug">{preview?.document.title ?? '资料详情'}</DialogTitle><DialogDescription>已提取 {preview?.chunks.length ?? 0} 个片段。发布前请核对原文；问答引用将指向对应章节或页码。</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {preview && <><div className="max-h-[42dvh] space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">{preview.chunks.map(chunk => <div key={chunk.ordinal} className="rounded-lg bg-white p-3 text-xs leading-6 text-slate-700"><p className="mb-1 font-bold text-teal-800">{chunk.section} · 片段 {chunk.ordinal + 1}</p>{chunk.content}</div>)}</div>
          {canManagePreview && preview.document.status === 'pending' && <div className="space-y-2"><Label htmlFor="knowledge-review-note">退回原因（退回时填写）</Label><Textarea id="knowledge-review-note" maxLength={500} rows={2} value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="请说明需要修改的内容" /><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void review(preview.document.id, 'approve')} className="bg-teal-700 hover:bg-teal-800">审核并发布</Button><Button disabled={busy || !reviewNote.trim()} variant="outline" onClick={() => void review(preview.document.id, 'reject')}>退回资料</Button></div></div>}
          {canManagePreview && preview.document.status === 'published' && <div className="flex flex-wrap gap-2"><Button disabled={busy} variant="outline" onClick={() => void review(preview.document.id, 'reindex')}>更新语义索引</Button><Button disabled={busy} variant="outline" onClick={() => void review(preview.document.id, 'archive')}>归档旧版本</Button></div>}
        </>}
      </DialogContent>
    </Dialog>
  </main>;
}
