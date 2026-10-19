'use client';
import { useEffect, useRef, useState } from 'react';
import { Droplets, FileSpreadsheet, Loader2, Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnalysisEvidence } from './analysis-evidence';
import { HistoryEvidence } from './history-evidence';
import { AnswerContent } from './answer-content';
import type { KnowledgeSource } from '@/lib/water-assistant/knowledge';
import { assistantFetch, AssistantSessionError } from '@/lib/water-assistant/request';

type Message = { role: 'user' | 'assistant'; content: string; evidence?: unknown[]; sources?: KnowledgeSource[] };
type ImportPreview = { success: boolean; count: number; errorCount: number; errors: string[]; warnings: string[]; approvedOutlets: string[]; approvedPollutants: string[]; sample: { outlet: string; time: string; pollutant: string; value: number; unit: string; threshold: number }[] };
export function AiChat({ userId, scope, canImport }: { userId: string; scope: string; canImport: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loginRequired, setLoginRequired] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const importRequest = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const conversation = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    setMessages([]); setError(''); setLoginRequired(false); setBusy(false); setQuestion(''); setFile(null); setImportPreview(null); setImportError(''); setImportBusy(false);
    return () => { pending.current?.abort(); importRequest.current?.abort(); };
  }, [userId]);
  useEffect(() => { conversation.current?.scrollTo({ top: conversation.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy, error, importPreview, importError]);
  async function uploadExcel(selected: File, preview: boolean, signal: AbortSignal) {
    const form = new FormData(); form.append('file', selected);
    const response = await assistantFetch(token => fetch(`/api/enterprise/monitoring/upload-excel?${preview ? 'preview=1' : 'strict=1'}`, { method: 'POST', headers: { 'x-session': token }, body: form, signal }), signal);
    const data = await response.json();
    if (!response.ok) throw new Error([data.error, ...(data.errors ?? []).slice(0, 3)].filter(Boolean).join('；') || 'Excel 处理失败');
    return data;
  }
  async function selectFile(selected: File) {
    importRequest.current?.abort();
    setFile(selected); setImportPreview(null); setImportError('');
    if (!/\.xlsx?$/i.test(selected.name) || selected.size > 2 * 1024 * 1024) { setImportError('请选择不超过2MB的 .xlsx 或 .xls 文件'); return; }
    const controller = new AbortController(); importRequest.current = controller; setImportBusy(true);
    try {
      const data: ImportPreview = await uploadExcel(selected, true, controller.signal);
      if (!controller.signal.aborted) setImportPreview(data);
    } catch (e) { if (!controller.signal.aborted) setImportError(e instanceof Error ? e.message : '预检失败，请重试'); }
    finally { if (importRequest.current === controller) { setImportBusy(false); importRequest.current = null; } }
  }
  async function confirmImport() {
    if (!file || !importPreview?.success || importBusy || busy) return;
    const controller = new AbortController(); importRequest.current = controller; setImportBusy(true); setImportError('');
    try {
      const data: { count: number; warnings: string[]; warningRecords: { id: string; at: string }[] } = await uploadExcel(file, false, controller.signal);
      if (controller.signal.aborted) return;
      setMessages(previous => [...previous,
        { role: 'user', content: `上传 Excel：${file.name}` },
        { role: 'assistant', content: `已按现有 Excel 规则录入 ${data.count} 条监测记录${data.warnings.length ? `，其中 ${data.warnings.length} 类指标出现超阈值记录` : ''}。你可以接着问我：“分析刚录入的这段时间的数据”。` },
      ]);
      window.dispatchEvent(new CustomEvent('water-monitoring-imported', { detail: { userId, warnings: data.warnings, warningRecords: data.warningRecords } }));
      setFile(null); setImportPreview(null);
    } catch (e) { if (!controller.signal.aborted) setImportError(e instanceof Error ? e.message : '录入失败，请重试'); }
    finally { if (importRequest.current === controller) { setImportBusy(false); importRequest.current = null; } }
  }
  async function send() {
    if (busy || importBusy || !question.trim()) return;
    const controller = new AbortController(); pending.current = controller;
    const next: Message[] = [...messages, { role: 'user', content: question.trim() }];
    setBusy(true); setError(''); setLoginRequired(false);
    try {
      const payload = JSON.stringify({ messages: next.slice(-11).map(({ role, content }) => ({ role, content })) });
      const response = await assistantFetch(token => fetch('/api/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: payload, signal: controller.signal }), controller.signal);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '分析失败');
      if (controller.signal.aborted) return;
      setMessages([...next, { role: 'assistant', content: data.answer, evidence: data.evidence, sources: data.sources }]); setQuestion('');
    } catch (e) { if (!controller.signal.aborted) { setLoginRequired(e instanceof AssistantSessionError); setError(e instanceof Error ? e.message : '网络异常，请重试'); } }
    finally { if (pending.current === controller) { setBusy(false); pending.current = null; } }
  }
  return <div className="relative flex h-full min-h-0 flex-col bg-white"
    onDragEnter={e => { if (!e.dataTransfer.types.includes('Files')) return; e.preventDefault(); dragDepth.current++; setDragging(true); }}
    onDragLeave={e => { e.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
    onDragOver={e => { if (!e.dataTransfer.types.includes('Files')) return; e.preventDefault(); e.dataTransfer.dropEffect = canImport ? 'copy' : 'none'; }}
    onDrop={e => { e.preventDefault(); dragDepth.current = 0; setDragging(false); if (!canImport) { setImportError('目前仅企业账号可通过小水滴录入监测数据'); return; } if (e.dataTransfer.files.length !== 1) { setImportError('一次请上传一个 Excel 文件'); return; } const selected = e.dataTransfer.files[0]; if (selected) void selectFile(selected); }}>
    <div className="flex shrink-0 items-center gap-2 border-b border-teal-100 bg-white px-5 py-3 text-sm text-slate-500">
      <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />AI 对话 <span className="text-slate-300">/</span> {scope}数据
    </div>
    <div ref={conversation} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5" role="log" aria-label="小水滴对话记录" aria-live="polite">
      {!messages.length && <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-slate-700">
        <p className="font-medium text-teal-900">嗨，我是小水滴！</p>
        <p className="mt-2 leading-relaxed">直接问我监测情况、系统操作或标准适用范围，也可以像聊天一样继续追问。我只会读取你有权限查看的数据。</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(scope === '所属园区' ? ['园区哪些企业比历史正常时期波动更大？', '近7天哪些企业有超阈值记录？', 'GB/T 14848适用于排污口吗？'] : ['现在和以前正常时相比，哪些污染物波动变大？', '本企业近7天和历史CDC有什么变化？', '我的排污口和审批阈值是什么？']).map(example => <Button key={example} type="button" size="sm" variant="outline" className="h-auto whitespace-normal rounded-full border-teal-200 bg-white py-1.5 text-left text-xs text-teal-800" onClick={() => { setQuestion(example); input.current?.focus(); }}>{example}</Button>)}
        </div>
      </div>}
      {messages.map((m, i) => <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        {m.role === 'assistant' && <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700"><Droplets className="size-4" /></span>}
        <div className={`min-w-0 rounded-2xl px-3.5 py-3 text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'max-w-[88%] rounded-tr-sm bg-teal-700 text-white' : 'w-full max-w-[calc(100%-2.25rem)] rounded-tl-sm border border-slate-100 bg-slate-50 text-slate-800'}`}>
          {m.role === 'assistant' ? <AnswerContent content={m.content} /> : <p className="whitespace-pre-wrap break-words">{m.content}</p>}
          <AnalysisEvidence evidence={m.evidence} admin={scope === '所属园区'} />
          <HistoryEvidence evidence={m.evidence} />
          {!!m.sources?.length && <div className="mt-3 space-y-2 border-t border-teal-100 pt-3" aria-label="参考资料"><p className="text-xs font-medium text-teal-800">资料依据</p>{m.sources.map(source => <details key={source.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs"><summary className="cursor-pointer text-slate-700">{source.title} · {source.section}</summary><p className="mt-2 text-slate-600">{source.excerpt}</p><p className="mt-1 text-slate-500">{source.version}</p>{source.url && <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-teal-700 underline">查看官方来源</a>}</details>)}</div>}
        </div>
      </div>)}
      {busy && <div role="status" className="flex items-center gap-2 text-sm text-teal-700"><Loader2 className="size-4 animate-spin" />正在查询并分析数据… <Button size="sm" variant="ghost" onClick={() => { pending.current?.abort(); setBusy(false); }}>取消</Button></div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error} {loginRequired && <a href="/login" className="font-semibold underline">前往登录</a>}</p>}
      {file && <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 text-sm text-slate-700">
        <div className="flex items-center gap-2 font-medium text-teal-900"><FileSpreadsheet className="size-5 shrink-0" /><span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span><Button size="icon" variant="ghost" aria-label="取消上传文件" disabled={importBusy} onClick={() => { setFile(null); setImportPreview(null); setImportError(''); }}><X className="size-4" /></Button></div>
        {importBusy && <p className="mt-2 flex items-center gap-2 text-xs text-teal-700" role="status"><Loader2 className="size-3 animate-spin" />正在{importPreview ? '录入' : '预检'}…</p>}
        {importPreview && <>
          <p className="mt-2 text-xs">可录入 <strong>{importPreview.count}</strong> 条监测记录；发现 <strong>{importPreview.errorCount}</strong> 处问题。</p>
          {!!importPreview.warnings.length && <p className="mt-1 text-xs text-amber-700">预警指标：{importPreview.warnings.join('、')}（按账号审批阈值判断）</p>}
          {!!importPreview.errors.length && <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-700">{importPreview.errors.map((item, i) => <li key={i}>{item}</li>)}</ul>}
          {!!importPreview.approvedOutlets.length && <p className="mt-2 text-xs text-slate-600">本企业可用排污口：{importPreview.approvedOutlets.slice(0, 8).join('、')}</p>}
          {!!importPreview.approvedPollutants.length && <p className="mt-1 text-xs text-slate-600">已审批指标：{importPreview.approvedPollutants.join('、')}</p>}
          {!!importPreview.sample.length && <div className="mt-3 overflow-x-auto rounded-lg border border-teal-100 bg-white"><table className="w-full min-w-[420px] text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-2">排污口</th><th className="p-2">北京时间</th><th className="p-2">指标</th><th className="p-2">数值</th></tr></thead><tbody>{importPreview.sample.map((r, i) => <tr key={i} className="border-t border-slate-100"><td className="p-2">{r.outlet}</td><td className="p-2">{new Date(r.time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}</td><td className="p-2">{r.pollutant}</td><td className="p-2">{r.value} {r.unit}</td></tr>)}</tbody></table></div>}
          <p className="mt-3 text-xs text-slate-600">确认后会保存到当前企业的监测数据。演示数据请只在测试账号录入，避免混入真实记录。</p>
          <Button className="mt-3 bg-teal-700 hover:bg-teal-800" size="sm" disabled={!importPreview.success || importBusy || busy} onClick={() => void confirmImport()}>确认录入 {importPreview.count} 条</Button>
        </>}
      </div>}
      {importError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{importError}</p>}
    </div>
    <div className="shrink-0 border-t border-slate-100 bg-white p-4">
      <form onSubmit={e => { e.preventDefault(); void send(); }} className="flex items-center gap-2">
        {canImport && <><input ref={fileInput} type="file" accept=".xlsx,.xls" className="sr-only" aria-label="上传 Excel 监测数据" onChange={e => { const selected = e.target.files?.[0]; if (selected) void selectFile(selected); e.target.value = ''; }} /><Button type="button" size="icon" variant="ghost" aria-label="添加 Excel 文件" title="上传 Excel 文件" onClick={() => fileInput.current?.click()}><Paperclip className="size-4" /></Button></>}
        <Input ref={input} aria-label="向小水滴提问" maxLength={2000} value={question} onChange={e => setQuestion(e.target.value)} disabled={busy || importBusy} placeholder="问问小水滴，或继续追问…" className="min-w-0 flex-1 rounded-xl" />
        <Button type="submit" aria-label="发送问题" className="shrink-0 rounded-xl bg-teal-700 hover:bg-teal-800" disabled={busy || importBusy || !question.trim()}><Send className="size-4" /><span className="hidden sm:inline">发送</span></Button>
      </form>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500"><span>{canImport ? '支持拖入 Excel · 先预检再录入' : '仅分析所属园区数据'}</span>{!!messages.length && <Button size="sm" variant="ghost" className="h-auto px-1 py-0 text-xs" disabled={busy} onClick={() => { setMessages([]); setError(''); }}>清空对话</Button>}</div>
    </div>
    {dragging && <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-teal-500 bg-teal-50/95 text-sm font-medium text-teal-800">{canImport ? '松开以添加 Excel 文件' : '当前账号暂不支持数据录入'}</div>}
  </div>;
}
