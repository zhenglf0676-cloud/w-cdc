'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Message = { role: 'user' | 'assistant'; content: string; evidence?: unknown[] };
export function AiChat({ token, userId }: { token: string; userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    setMessages([]); setError(''); setBusy(false); setQuestion('');
    return () => { pending.current?.abort(); };
  }, [userId]);
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
  return <div className="mt-4 border-t pt-3">
    <h3 className="text-sm font-semibold text-teal-900">AI水质分析</h3>
    <p className="mt-1 text-xs text-slate-500">仅分析当前账号可访问的数据 · 日期按北京时间</p>
    <div className="my-3 max-h-72 space-y-3 overflow-auto" aria-live="polite">
      {messages.map((m, i) => <div key={i} className={`rounded-lg p-3 text-sm ${m.role === 'user' ? 'bg-slate-100' : 'bg-teal-50'}`}>
        <p className="mb-1 text-xs text-slate-500">{m.role === 'user' ? '你' : '小水滴'}</p>
        <p className="whitespace-pre-wrap break-words">{m.content}</p>
        {!!m.evidence?.length && <details className="mt-2"><summary className="cursor-pointer text-xs text-teal-700">查看计算结果与记录证据</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(m.evidence, null, 2)}</pre></details>}
      </div>)}
    </div>
    {!messages.length && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setQuestion('分析近7天的水质异常')}>试问：分析近7天的水质异常</Button>}
    <form onSubmit={e => { e.preventDefault(); void send(); }} className="mt-2 flex gap-2">
      <Input aria-label="向小水滴提问" maxLength={2000} value={question} onChange={e => setQuestion(e.target.value)} disabled={busy} placeholder="输入问题，或继续追问…" />
      <Button type="submit" disabled={busy || !question.trim()}>发送</Button>
    </form>
    {busy && <div role="status" className="mt-2 text-xs text-teal-700">正在分析，可能需要查询和计算数据…<Button size="sm" variant="ghost" onClick={() => { pending.current?.abort(); setBusy(false); }}>取消</Button></div>}
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error} 可再次点击发送重试。</p>}
    {!!messages.length && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMessages([])}>清空对话</Button>}
  </div>;
}
