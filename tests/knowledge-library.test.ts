import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canOpenKnowledge, canReviewKnowledge, canViewKnowledge } from '../src/lib/water-assistant/knowledge-auth';
import { chunkKnowledge, extractKnowledgeFile } from '../src/lib/water-assistant/knowledge-files';
import { embedKnowledge, knowledgeTerms, searchScopedKnowledge } from '../src/lib/water-assistant/knowledge-retrieval';
import type { SupabaseClient } from '@supabase/supabase-js';
import { keepVerifiedCitations } from '../src/lib/water-assistant/knowledge';

const enterpriseA = { userId: 'a', role: 'enterprise' as const, park: '园区一' };
const enterpriseB = { userId: 'b', role: 'enterprise' as const, park: '园区一' };
const adminA = { userId: 'admin-a', role: 'admin' as const, park: '园区一' };
const adminOther = { userId: 'admin-b', role: 'admin' as const, park: '园区二' };
const enterpriseDoc = { visibility: 'enterprise' as const, park_name: '园区一', company_user_id: 'a', uploaded_by: 'a', status: 'published', valid_from: null, valid_until: null };

test('company documents are only readable by the company and its park admin', () => {
  assert.equal(canViewKnowledge(enterpriseA, enterpriseDoc), true);
  assert.equal(canViewKnowledge(enterpriseB, enterpriseDoc), false);
  assert.equal(canViewKnowledge(adminA, enterpriseDoc), true);
  assert.equal(canViewKnowledge(adminOther, enterpriseDoc), false);
  assert.equal(canReviewKnowledge(adminA, enterpriseDoc), true);
  assert.equal(canReviewKnowledge(adminOther, enterpriseDoc), false);
});

test('pending and expired documents cannot be used as published evidence', () => {
  assert.equal(canViewKnowledge(enterpriseA, { ...enterpriseDoc, status: 'pending' }), false);
  assert.equal(canOpenKnowledge(enterpriseA, { ...enterpriseDoc, status: 'pending' }), true); // uploader preview
  assert.equal(canViewKnowledge(enterpriseB, { ...enterpriseDoc, status: 'pending' }), false);
  assert.equal(canViewKnowledge(enterpriseA, { ...enterpriseDoc, valid_until: '2020-01-01' }), false);
  assert.equal(canViewKnowledge(enterpriseA, { ...enterpriseDoc, valid_from: '2099-01-01' }), false);
  assert.equal(canViewKnowledge(enterpriseB, { ...enterpriseDoc, visibility: 'park', company_user_id: null }), true);
  assert.equal(canViewKnowledge(adminOther, { ...enterpriseDoc, visibility: 'public', park_name: null, company_user_id: null }), true);
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
