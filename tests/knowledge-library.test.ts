import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canOpenKnowledge, canReviewKnowledge, canViewKnowledge } from '../src/lib/water-assistant/knowledge-auth';
import { chunkKnowledge, extractKnowledgeFile } from '../src/lib/water-assistant/knowledge-files';
import { embedKnowledge, isEvidenceChunk, knowledgeTerms, searchScopedKnowledge } from '../src/lib/water-assistant/knowledge-retrieval';
import type { SupabaseClient } from '@supabase/supabase-js';
import { citedKnowledge, keepVerifiedCitations } from '../src/lib/water-assistant/knowledge';

const enterpriseA = { userId: 'a', role: 'enterprise' as const, park: '园区一' };
const enterpriseB = { userId: 'b', role: 'enterprise' as const, park: '园区一' };
const adminA = { userId: 'admin-a', role: 'admin' as const, park: '园区一' };
const adminOther = { userId: 'admin-b', role: 'admin' as const, park: '园区二' };
const enterpriseDoc = { visibility: 'enterprise' as const, park_name: '园区一', company_user_id: 'a', uploaded_by: 'a', status: 'published', valid_from: null, valid_until: null };

test('company documents are readable by their company and every admin', () => {
  assert.equal(canViewKnowledge(enterpriseA, enterpriseDoc), true);
  assert.equal(canViewKnowledge(enterpriseB, enterpriseDoc), false);
  assert.equal(canViewKnowledge(adminA, enterpriseDoc), true);
  assert.equal(canViewKnowledge(adminOther, enterpriseDoc), true);
  assert.equal(canReviewKnowledge(adminA), true);
  assert.equal(canReviewKnowledge(adminOther), true);
  assert.equal(canReviewKnowledge(enterpriseA), false);
});

test('pending and expired documents cannot be used as published evidence', () => {
  assert.equal(canViewKnowledge(enterpriseA, { ...enterpriseDoc, status: 'pending' }), false);
  assert.equal(canOpenKnowledge(enterpriseA, { ...enterpriseDoc, status: 'pending' }), true); // uploader preview
  assert.equal(canViewKnowledge(enterpriseB, { ...enterpriseDoc, status: 'pending' }), false);
  assert.equal(canOpenKnowledge(enterpriseB, { ...enterpriseDoc, status: 'pending' }), false);
  assert.equal(canOpenKnowledge(adminOther, { ...enterpriseDoc, status: 'pending' }), true); // admin review
  assert.equal(canViewKnowledge(enterpriseA, { ...enterpriseDoc, valid_until: '2020-01-01' }), false);
  assert.equal(canViewKnowledge(enterpriseA, { ...enterpriseDoc, valid_from: '2099-01-01' }), false);
  assert.equal(canViewKnowledge(enterpriseB, { ...enterpriseDoc, visibility: 'park', company_user_id: null }), false);
  assert.equal(canViewKnowledge(adminOther, { ...enterpriseDoc, visibility: 'park', company_user_id: null }), true);
  assert.equal(canViewKnowledge(adminOther, { ...enterpriseDoc, visibility: 'public', park_name: null, company_user_id: null }), true);
  assert.equal(canViewKnowledge(enterpriseB, { ...enterpriseDoc, visibility: 'public', park_name: null, company_user_id: null }), true);
});

test('text upload preserves sections and does not silently accept empty scans', async () => {
  const file = new File(['总磷采样记录与质控说明。'.repeat(8)], 'sampling.txt', { type: 'text/plain' });
  const sections = await extractKnowledgeFile(file);
  const chunks = chunkKnowledge(sections);
  assert.equal(chunks[0].section, '第 1 段');
  assert.match(chunks[0].content, /总磷采样记录/);
  await assert.rejects(extractKnowledgeFile(new File(['hello'], 'scan.txt')), /没有提取到足够/);
});

test('document section boundaries survive chunking and exact standard identifiers remain searchable', () => {
  const chunks = chunkKnowledge([{ section: '第 2 页', text: 'A'.repeat(950) }, { section: '第 3 页', text: '总磷值与采样质控说明。'.repeat(9) }]);
  assert.equal(chunks[0].section, '第 2 页');
  assert.equal(chunks.at(-1)?.section, '第 3 页');
  assert.ok(knowledgeTerms('GB/T 14848 对总磷和排污口适用吗？').some(term => /14848/.test(term)));
  const terms = knowledgeTerms('井水读数升高，从现场取样到实验室怎么核查？');
  assert.ok(terms.includes('地下水'));
  assert.ok(terms.includes('采样'));
});

test('neighboring chunks overlap so a fact at a boundary remains searchable', () => {
  const content = 'A'.repeat(870) + '跨段阈值依据' + 'B'.repeat(180);
  const chunks = chunkKnowledge([{ section: '第 2 页', text: content }]);
  assert.equal(chunks.length, 2);
  assert.ok(chunks[0].content.includes('跨段阈值依据'));
  assert.ok(chunks[1].content.includes('跨段阈值依据'));
  assert.equal(chunks[1].section, '第 2 页');
});

test('embedding response index determines chunk alignment even if provider returns rows out of order', async () => {
  const previousKey = process.env.WATER_AI_EMBEDDING_API_KEY;
  const previousModel = process.env.WATER_AI_EMBEDDING_MODEL;
  const previousFetch = globalThis.fetch;
  process.env.WATER_AI_EMBEDDING_API_KEY = 'test-only';
  process.env.WATER_AI_EMBEDDING_MODEL = 'text-embedding-v4';
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [
    { index: 1, embedding: Array(1024).fill(0.2) },
    { index: 0, embedding: Array(1024).fill(0.1) },
  ] }), { status: 200 });
  try {
    const vectors = await embedKnowledge(['first', 'second']);
    assert.equal(vectors?.[0][0], 0.1);
    assert.equal(vectors?.[1][0], 0.2);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.WATER_AI_EMBEDDING_API_KEY;
    else process.env.WATER_AI_EMBEDDING_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.WATER_AI_EMBEDDING_MODEL;
    else process.env.WATER_AI_EMBEDDING_MODEL = previousModel;
  }
});

test('an archived built-in document cannot reappear from the static fallback', async () => {
  const previousKey = process.env.WATER_AI_EMBEDDING_API_KEY;
  const previousModel = process.env.WATER_AI_EMBEDDING_MODEL;
  delete process.env.WATER_AI_EMBEDDING_API_KEY;
  delete process.env.WATER_AI_EMBEDDING_MODEL;
  const client = { rpc: async () => ({ data: [], error: null }) } as unknown as SupabaseClient;
  try {
    assert.deepEqual(await searchScopedKnowledge(client, 'GB/T 14848 地下水质量标准'), []);
  } finally {
    if (previousKey !== undefined) process.env.WATER_AI_EMBEDDING_API_KEY = previousKey;
    if (previousModel !== undefined) process.env.WATER_AI_EMBEDDING_MODEL = previousModel;
  }
});

test('a knowledge database failure does not revive static excerpts', async () => {
  const previousKey = process.env.WATER_AI_EMBEDDING_API_KEY;
  const previousModel = process.env.WATER_AI_EMBEDDING_MODEL;
  delete process.env.WATER_AI_EMBEDDING_API_KEY;
  delete process.env.WATER_AI_EMBEDDING_MODEL;
  const client = { rpc: async () => ({ data: null, error: { message: 'unavailable' } }) } as unknown as SupabaseClient;
  try {
    await assert.rejects(searchScopedKnowledge(client, 'GB/T 14848 地下水质量标准'), /资料库检索失败/);
  } finally {
    if (previousKey !== undefined) process.env.WATER_AI_EMBEDDING_API_KEY = previousKey;
    if (previousModel !== undefined) process.env.WATER_AI_EMBEDDING_MODEL = previousModel;
  }
});

test('a fabricated citation label is removed from the displayed answer', () => {
  assert.equal(keepVerifiedCitations('见[资料1]，另见[资料9]。', [{ id: '1', title: 'a', section: 'b', version: 'c', excerpt: 'd', citation: '资料1' }]), '见[资料1]，另见。');
});

test('retrieval excludes upload test instructions and title-only headings without hiding short factual notes', async () => {
  assert.equal(isEvidenceChunk('检索验收：上传后可以提问什么？'), false);
  assert.equal(isEvidenceChunk('HJ 212—2025《污染物自动监测监控系统数据传输技术要求》上传测试摘要'), false);
  assert.equal(isEvidenceChunk('没有记录不能说明水质正常。'), true);
  const rows = [
    { id: 'meta', excerpt: '检索验收：问这个问题看能否找到本段。', score: 3 },
    { id: 'heading', excerpt: 'HJ 212—2025 上传测试摘要', score: 2 },
    { id: 'evidence', excerpt: '缺记录时应核对设备、数据采集与传输链路。', score: 1 },
  ];
  const client = { rpc: async (_name: string, args: { p_limit: number }) => {
    assert.equal(args.p_limit, 6);
    return { data: rows.map(row => ({ ...row, document_id: row.id, title: '测试资料', section: '正文', version: '1', source_url: null, file_name: '测试.txt', has_file: true })), error: null };
  } } as unknown as SupabaseClient;
  assert.deepEqual((await searchScopedKnowledge(client, '数据传输中断')).map(source => source.id), ['evidence']);
});

test('answer cites only used documents and renumbers sources without gaps', () => {
  const sources = [1, 2, 3, 4].map(index => ({ id: String(index), title: String(index), section: '正文', version: '1', excerpt: '说明。', citation: `资料${index}` }));
  const result = citedKnowledge('依据[资料1]和[资料4]，没有[资料9]。', sources);
  assert.equal(result.answer, '依据[资料1]和[资料2]，没有。');
  assert.deepEqual(result.sources.map(source => source.id), ['1', '4']);
  assert.deepEqual(result.sources.map(source => source.citation), ['资料1', '资料2']);
});
