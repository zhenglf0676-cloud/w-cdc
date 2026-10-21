import { presentAnswer } from '@/lib/water-assistant/answer';

function Inline({ text, tone = 'default' }: { text: string; tone?: 'default' | 'caution' | 'detail' }) {
  const emphasis = tone === 'caution' ? 'font-bold text-amber-950' : tone === 'detail' ? 'font-semibold text-slate-900' : 'font-bold text-teal-900';
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={i} className={emphasis}>{part.slice(2, -2)}</strong>
    : part)}</>;
}

function DetailText({ text }: { text: string }) {
  return <div className="space-y-2 text-[13px] leading-6 text-slate-600 sm:text-sm">
    {text.split(/\n+/).flatMap((line, lineIndex) => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      if (/^[-•]\s+/.test(trimmed)) return [<p key={lineIndex} className="pl-3 before:mr-2 before:text-teal-600 before:content-['•']"><Inline text={trimmed.replace(/^[-•]\s+/, '')} tone="detail" /></p>];
      const pieces = trimmed.length > 200 ? trimmed.match(/[^。！？]+[。！？]?/g) ?? [trimmed] : [trimmed];
      return pieces.filter(Boolean).map((piece, i) => <p key={`${lineIndex}-${i}`}><Inline text={piece.trim()} tone="detail" /></p>);
    })}
  </div>;
}

export function AnswerContent({ content }: { content: string }) {
  const answer = presentAnswer(content);
  return <div className="space-y-4 break-words">
    <section className="rounded-xl border border-teal-100 border-l-4 border-l-teal-500 bg-white px-4 py-3.5 shadow-xs">
      <p className="text-xs font-bold tracking-wide text-teal-700">核心结论</p>
      <p className="mt-1.5 text-base font-semibold leading-7 text-slate-900 sm:text-[17px]"><Inline text={answer.summary} /></p>
    </section>
    {!!answer.points.length && <section aria-label="关键发现" className="space-y-2.5 px-1">
      <h3 className="text-sm font-bold text-slate-900">关键发现</h3>
      <ul className="space-y-2.5">{answer.points.map((point, i) => <li key={i} className="flex gap-2.5 text-sm font-normal leading-6 text-slate-700"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-500" /><span><Inline text={point} /></span></li>)}</ul>
    </section>}
    {answer.caution && <section aria-label="口径提醒" className="rounded-lg border-l-2 border-amber-400 bg-amber-50 px-3.5 py-2.5 text-[13px] font-normal leading-6 text-amber-900">
      <span className="font-bold">口径提醒：</span><Inline text={answer.caution} tone="caution" />
    </section>}
    {answer.detail && <details className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
      <summary className="cursor-pointer text-[13px] font-semibold text-teal-800 marker:text-teal-600">展开完整分析</summary>
      <div className="mt-3 border-t border-slate-100 pt-3"><DetailText text={answer.detail} /></div>
    </details>}
  </div>;
}
