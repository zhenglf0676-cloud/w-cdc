import type { SupabaseClient } from '@supabase/supabase-js';
import type { KnowledgeSource } from './knowledge';

const baseUrl = () => (process.env.WATER_AI_EMBEDDING_BASE_URL || process.env.WATER_AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');

export async function embedKnowledge(texts: string[]): Promise<number[][] | null> {
  const key = process.env.WATER_AI_EMBEDDING_API_KEY || process.env.WATER_AI_API_KEY;
  if (!key || !texts.length || !process.env.WATER_AI_EMBEDDING_MODEL && !process.env.WATER_AI_EMBEDDING_API_KEY) return null;
  try {
    const response = await fetch(`${baseUrl()}/embeddings`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.WATER_AI_EMBEDDING_MODEL || 'text-embedding-v4', input: texts, dimensions: 1024 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('data' in data) || !Array.isArray(data.data) || data.data.length !== texts.length) return null;
    const vectors: number[][] = Array.from({ length: texts.length });
    const seen = new Set<number>();
    for (const [position, item] of data.data.entries()) {
      if (!item || typeof item !== 'object') return null;
      const result = item as { index?: unknown; embedding?: unknown };
      const index = result.index === undefined ? position : result.index;
      if (!Number.isInteger(index) || typeof index !== 'number' || index < 0 || index >= texts.length || seen.has(index) ||
        !Array.isArray(result.embedding) || result.embedding.length !== 1024 ||
        !result.embedding.every((n: unknown) => typeof n === 'number' && Number.isFinite(n))) return null;
      seen.add(index);
      vectors[index] = result.embedding as number[];
    }
    return vectors;
  } catch { return null; }
}

export async function indexKnowledgeDocument(client: SupabaseClient, documentId: string): Promise<'hybrid' | 'keyword'> {
  const { data: chunks, error } = await client.from('assistant_knowledge_chunks').select('id,content').eq('document_id', documentId).order('ordinal').limit(66);
  if (error || !chunks?.length || chunks.length > 65) throw new Error('资料片段读取失败');
  const clearPartialIndex = async () => {
    const cleared = await client.from('assistant_knowledge_chunks').update({ embedding: null }).eq('document_id', documentId);
    if (cleared.error) throw new Error('语义索引清理失败');
  };
  const all: number[][] = [];
  for (let i = 0; i < chunks.length; i += 10) {
    const batch = await embedKnowledge(chunks.slice(i, i + 10).map(chunk => chunk.content));
    if (!batch) { await clearPartialIndex(); return 'keyword'; }
    all.push(...batch);
  }
  for (const [index, chunk] of chunks.entries()) {
    const result = await client.from('assistant_knowledge_chunks').update({ embedding: JSON.stringify(all[index]) }).eq('id', chunk.id).eq('document_id', documentId);
    if (result.error) { await clearPartialIndex(); throw new Error('语义索引保存失败'); }
  }
  return 'hybrid';
}

export function knowledgeTerms(question: string): string[] {
  const exact = question.match(/(?:GB\/?T|GB|HJ)\s*\d{2,6}(?:-\d{4})?|COD|NH3-N|SKEW|CDC|总磷|总氮|氨氮|重金属|排污口|排口|采样|质控|排放|阈值|监测|许可证|地下水|污水|异常|波动|偏度|变异系数|报告|上传|录入/gi) ?? [];
  const synonyms = [
    ...(/取样/u.test(question) ? ['采样'] : []),
    ...(/井水|监测井/u.test(question) ? ['地下水'] : []),
    ...(/断流|断数|传输中断/u.test(question) ? ['数据传输'] : []),
  ];
  const generic = new Set(['请问', '什么', '我们', '怎么', '如何', '是否', '可以', '一下', '企业', '现在', '过去', '这个', '数据']);
  const phrases = (question.match(/[\u3400-\u9fff]{2,}/g) ?? []).flatMap(part => part.length <= 4 ? [part] : Array.from({ length: part.length - 2 }, (_, i) => part.slice(i, i + 3)));
  return [...new Set([...exact.map(term => term.trim()), ...synonyms, ...phrases.filter(term => !generic.has(term))])].slice(0, 16);
}

type SearchRow = { id: string; document_id: string; title: string; section: string; version: string; excerpt: string; source_url: string | null; file_name: string; has_file: boolean; score: number };

/** Headings and instructions about testing the library are not evidence for a water-quality answer. */
export function isEvidenceChunk(excerpt: string): boolean {
  const content = excerpt.trim();
  if (/^(?:检索验收|测试提问|验收提问|检索测试)\s*[：:]/u.test(content)) return false;
  return content.length >= 80 || /[。！？.!?；;]/u.test(content);
}

/** The caller uses a user-scoped Supabase client: the SQL function applies RLS before ranking. */
export async function searchScopedKnowledge(client: SupabaseClient, query: string): Promise<KnowledgeSource[]> {
  const vector = (await embedKnowledge([query]))?.[0];
  const { data, error } = await client.rpc('assistant_search_knowledge', {
    p_query: query.slice(0, 120), p_terms: knowledgeTerms(query), p_embedding: vector ? JSON.stringify(vector) : null, p_limit: 6,
  });
  if (error) throw new Error('资料库检索失败');
  const databaseSources = ((data ?? []) as SearchRow[]).filter(row => row.score > 0 && isEvidenceChunk(row.excerpt)).slice(0, 5).map(row => ({
    id: row.id, documentId: row.document_id, title: row.title, section: row.section,
    version: row.version, excerpt: row.excerpt, url: row.source_url ?? undefined, hasFile: row.has_file, fileName: row.file_name,
  }));
  // Once the database responds, it is the only source of truth: an archived or
  // expired built-in excerpt must not reappear from the old static fallback.
  return databaseSources;
}
