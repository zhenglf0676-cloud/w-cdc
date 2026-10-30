import { NextResponse } from 'next/server';
import { z } from 'zod';
import { knowledgeActor, KnowledgeError } from '@/lib/water-assistant/knowledge-auth';
import { searchScopedKnowledge } from '@/lib/water-assistant/knowledge-retrieval';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
const input = z.object({ query: z.string().trim().min(2).max(120) }).strict();

export async function POST(request: Request) {
  try {
    const actor = await knowledgeActor(request);
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: '请输入 2 至 120 字的检索问题' }, { status: 400, headers });
    // The user token is essential: the RPC checks document and chunk RLS before ranking.
    const token = request.headers.get('x-auth-token')!;
    const sources = await searchScopedKnowledge(getSupabaseClient(token), parsed.data.query);
    return NextResponse.json({ sources, scope: actor.role === 'admin' ? '全部已发布资料' : '公共资料及本企业' }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof KnowledgeError ? error.message : '资料检索暂不可用，请稍后再试' },
      { status: error instanceof KnowledgeError ? error.status : 503, headers });
  }
}
