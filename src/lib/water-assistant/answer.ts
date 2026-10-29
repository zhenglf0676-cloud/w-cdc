export type AnswerPresentation = {
  summary: string;
  points: string[];
  caution: string;
  detail: string;
};

type Section = 'summary' | 'points' | 'caution' | 'detail';
const headings: Record<string, Section> = {
  '结论': 'summary', '关键发现': 'points', '要点': 'points',
  '提醒': 'caution', '口径提醒': 'caution', '口径与局限': 'caution',
  '补充说明': 'caution', '展开': 'detail', '详细分析': 'detail',
};
const heading = /^\s*(?:#{1,3}\s*)?(?:\*\*)?(?:【)?(结论|关键发现|要点|提醒|口径提醒|口径与局限|补充说明|展开|详细分析)(?:】)?(?:\*\*)?\s*[:：]?\s*(.*)$/;
const bullet = /^\s*(?:[-•]\s+|\d+[.、]\s+)/;

/** Present the whole model answer, keeping lengthy reasoning available in a disclosure. */
export function presentAnswer(content: string): AnswerPresentation {
  const lines = content.replace(/\r\n?/g, '\n').trim().split('\n');
  const sections: Record<Section, string[]> = { summary: [], points: [], caution: [], detail: [] };
  let active: Section | null = null;
  let structured = false;
  const intro: string[] = [];
  for (const line of lines) {
    const match = line.match(heading);
    if (match) {
      structured = true;
      active = headings[match[1]];
      if (match[2]) sections[active].push(match[2]);
    } else if (active) sections[active].push(line);
    else intro.push(line);
  }

  if (structured) {
    const points = sections.points.map(line => line.replace(bullet, '').trim()).filter(Boolean);
    const summary = sections.summary.join(' ').trim() || intro.join(' ').trim();
    const detail = sections.detail.join('\n').trim();
    return {
      summary: summary || points.shift() || '',
      points,
      caution: sections.caution.join('\n').trim(),
      detail: [intro.join('\n').trim() === summary ? '' : intro.join('\n').trim(), detail].filter(Boolean).join('\n\n'),
    };
  }

  const plain = content.trim();
  if (plain.length <= 190) return { summary: plain, points: [], caution: '', detail: '' };
  // Earlier replies did not have sections. Keep their first useful sentences visible.
  const sentences = plain.match(/[^。！？\n]+[。！？]?|\n+/g) ?? [plain];
  let used = 0;
  let summary = '';
  for (const sentence of sentences) {
    if (!sentence.trim()) break;
    if (summary && summary.length + sentence.length > 165) break;
    summary += sentence;
    used += sentence.length;
    if (summary.length >= 80) break;
  }
  if (!summary) { summary = plain.slice(0, 165); used = summary.length; }
  return { summary: summary.trim(), points: [], caution: '', detail: plain.slice(used).trim() };
}
