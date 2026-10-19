'use client';
import { useEffect, useRef, useState } from 'react';
import { Droplets, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Message = { role: 'user' | 'assistant'; content: string; evidence?: unknown[] };
export function AiChat({ token, userId, scope }: { token: string; userId: string; scope: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setMessages([]); setError(''); setBusy(false); setQuestion('');
    return () => { pending.current?.abort(); };
  }, [userId]);
  useEffect(() => { conversation.current?.scrollTo({ top: conversation.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy, error]);
  async function send() {
    if (busy || !question.trim()) return;
    const controller = new AbortController(); pending.current = controller;
    const next: Message[] = [...messages, { role: 'user', content: question.trim() }];
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: JSON.stringify({ messages: next.slice(-11).map(({ role, content }) => ({ role, content })) }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '分析失败');
      if (controller.signal.aborted) return;
      setMessages([...next, { role: 'assistant', content: data.answer, evidence: data.evidence }]); setQuestion('');
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '网络异常，请重试'); }
    finally { if (pending.current === controller) { setBusy(false); pending.current = null; } }
  }
  return <div className="flex h-full min-h-0 flex-col bg-white">
    <div className="flex shrink-0 items-center gap-2 border-b border-teal-100 bg-white px-5 py-3 text-sm text-slate-500">
      <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />AI 对话 <span className="text-slate-300">/</span> {scope}数据
    </div>
    <div ref={conversation} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5" role="log" aria-label="小水滴对话记录" aria-live="polite">
      {!messages.length && <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-slate-700">
        <p className="font-medium text-teal-900">嗨，我是小水滴！</p>
        <p className="mt-2 leading-relaxed">直接告诉我你想了解的水质情况，也可以像聊天一样继续追问。我只会读取你有权限查看的数据。</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {['分析近7天的水质异常', '最近一个月有什么变化？', '对比本周与上周的数据'].map(example => <Button key={example} type="button" size="sm" variant="outline" className="h-auto whitespace-normal rounded-full border-teal-200 bg-white py-1.5 text-left text-xs text-teal-800" onClick={() => { setQuestion(example); input.current?.focus(); }}>{example}</Button>)}
        </div>
      </div>}
      {messages.map((m, i) => <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        {m.role === 'assistant' && <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700"><Droplets className="size-4" /></span>}
        <div className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'rounded-tr-sm bg-teal-700 text-white' : 'rounded-tl-sm border border-slate-100 bg-slate-50 text-slate-800'}`}>
          <p className="whitespace-pre-wrap break-words">{m.content}</p>
          {!!m.evidence?.length && <details className="mt-3 border-t border-teal-100 pt-2"><summary className="cursor-pointer text-xs font-medium text-teal-700">查看计算结果与记录证据</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white p-2 text-xs text-slate-600">{JSON.stringify(m.evidence, null, 2)}</pre></details>}
        </div>
      </div>)}
      {busy && <div role="status" className="flex items-center gap-2 text-sm text-teal-700"><Loader2 className="size-4 animate-spin" />正在查询并分析数据… <Button size="sm" variant="ghost" onClick={() => { pending.current?.abort(); setBusy(false); }}>取消</Button></div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error} 可再次点击发送重试。</p>}
    </div>
    <div className="shrink-0 border-t border-slate-100 bg-white p-4">
      <form onSubmit={e => { e.preventDefault(); void send(); }} className="flex items-center gap-2">
        <Input ref={input} aria-label="向小水滴提问" maxLength={2000} value={question} onChange={e => setQuestion(e.target.value)} disabled={busy} placeholder="问问小水滴，或继续追问…" className="min-w-0 flex-1 rounded-xl" />
        <Button type="submit" aria-label="发送问题" className="shrink-0 rounded-xl bg-teal-700 hover:bg-teal-800" disabled={busy || !question.trim()}><Send className="size-4" /><span className="hidden sm:inline">发送</span></Button>
      </form>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500"><span>分析结果请以原始监测记录为准</span>{!!messages.length && <Button size="sm" variant="ghost" className="h-auto px-1 py-0 text-xs" disabled={busy} onClick={() => { setMessages([]); setError(''); }}>清空对话</Button>}</div>
    </div>
  </div>;
}
