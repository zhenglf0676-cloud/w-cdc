import { presentAnswer } from '@/lib/water-assistant/answer';

function Inline({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
    : part)}</>;
}

function DetailText({ text }: { text: string }) {
  return <div className="space-y-2 text-sm leading-7 text-slate-600">
    {text.split(/\n+/).flatMap((line, lineIndex) => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      if (/^[-•]\s+/.test(trimmed)) return [<p key={lineIndex} className="pl-3 before:mr-2 before:text-teal-600 before:content-['•']"><Inline text={trimmed.replace(/^[-•]\s+/, '')} /></p>];
      const pieces = trimmed.length > 200 ? trimmed.match(/[^。！？]+[。！？]?/g) ?? [trimmed] : [trimmed];
      return pieces.filter(Boolean).map((piece, i) => <p key={`${lineIndex}-${i}`}><Inline text={piece.trim()} /></p>);
    })}
  </div>;
}

export function AnswerContent({ content }: { content: string }) {
  const answer = presentAnswer(content);
  return <div className="space-y-3 break-words">
    <section className="rounded-xl border border-teal-100 border-l-4 border-l-teal-500 bg-white px-3.5 py-3 shadow-xs">
      <p className="text-[11px] font-semibold tracking-wide text-teal-700">结论</p>
      <p className="mt-1 text-[15px] font-medium leading-7 text-slate-900"><Inline text={answer.summary} /></p>
    </section>
    {!!answer.points.length && <section aria-label="关键发现" className="space-y-2 px-1">
      <h3 className="text-xs font-semibold text-slate-800">关键发现</h3>
      <ul className="space-y-2">{answer.points.map((point, i) => <li key={i} className="flex gap-2 text-sm leading-6 text-slate-700"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-500" /><span><Inline text={point} /></span></li>)}</ul>
    </section>}
    {answer.caution && <section aria-label="口径提醒" className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
      <span className="font-semibold">口径提醒：</span><Inline text={answer.caution} />
    </section>}
    {answer.detail && <details className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
      <summary className="cursor-pointer text-xs font-semibold text-teal-800 marker:text-teal-600">展开完整分析</summary>
      <div className="mt-3 border-t border-slate-100 pt-3"><DetailText text={answer.detail} /></div>
    </details>}
  </div>;
}
