import { NextResponse } from 'next/server';
import { z } from 'zod';
import { chunkKnowledge, extractKnowledgeFile } from '@/lib/water-assistant/knowledge-files';
import { knowledgeActor, knowledgeAdminClient, canReviewKnowledge, canOpenKnowledge, KnowledgeError } from '@/lib/water-assistant/knowledge-auth';
import { indexKnowledgeDocument } from '@/lib/water-assistant/knowledge-retrieval';

export const runtime = 'nodejs';
export const maxDuration = 120;
const noStore = { 'Cache-Control': 'private, no-store' };
const shortText = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
const date = z.union([z.literal(''), z.iso.date()]);
// Built-in documents use deterministic Postgres UUIDs derived from their slug.
// z.uuid() rejects some valid Postgres UUIDs because their version bits vary.
const documentId = z.guid();
const actionSchema = z.object({ id: documentId, action: z.enum(['approve', 'reject', 'archive', 'reindex']), note: z.string().max(500).optional() }).strict();

function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof KnowledgeError ? error.message : error instanceof Error && /^(资料|PDF|Word|没有提取|请选择|文件|文本|标题|版本)/.test(error.message) ? error.message : '资料库操作失败，请稍后重试' },
    { status: error instanceof KnowledgeError ? error.status : error instanceof Error && /^(资料|PDF|Word|没有提取|请选择|文件|文本|标题|版本)/.test(error.message) ? 400 : 503, headers: noStore });
}

export async function GET(request: Request) {
  try {
    const actor = await knowledgeActor(request);
    const client = knowledgeAdminClient();
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      if (!documentId.safeParse(id).success) throw new KnowledgeError('资料编号无效', 400);
      const { data: doc, error } = await client.from('assistant_knowledge_documents').select('*').eq('id', id).single();
      if (error || !doc || !canOpenKnowledge(actor, doc)) throw new KnowledgeError('资料不存在或不在权限范围内', 404);
      const { data: chunks, error: chunkError } = await client.from('assistant_knowledge_chunks').select('ordinal,section,content').eq('document_id', id).order('ordinal').limit(65);
      if (chunkError) throw chunkError;
      return NextResponse.json({ document: doc, chunks }, { headers: noStore });
    }
    const fields = 'id,title,version,visibility,park_name,company_user_id,status,file_name,embedding_status,uploaded_by,review_note,created_at,reviewed_at,valid_from,valid_until';
    const visibleQueries = actor.role === 'admin'
      ? [client.from('assistant_knowledge_documents').select(fields).order('created_at', { ascending: false }).limit(1000)]
      : [
          client.from('assistant_knowledge_documents').select(fields).eq('company_user_id', actor.userId).order('created_at', { ascending: false }).limit(100),
          client.from('assistant_knowledge_documents').select(fields).eq('visibility', 'public').eq('status', 'published').order('created_at', { ascending: false }).limit(100),
        ];
    const results = await Promise.all(visibleQueries);
    const documents = [...new Map(results.flatMap(result => {
      if (result.error) throw result.error;
      return result.data ?? [];
    }).filter(doc => canOpenKnowledge(actor, doc)).map(doc => [doc.id, doc])).values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return NextResponse.json({ documents }, { headers: noStore });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  let storagePath: string | null = null;
  try {
    const actor = await knowledgeActor(request);
    const client = knowledgeAdminClient();
    const form = await request.formData();
    const title = shortText(form, 'title');
    const version = shortText(form, 'version') || '1.0';
    const visibility = actor.role === 'enterprise' ? 'enterprise' : 'public';
    const validFrom = shortText(form, 'validFrom');
    const validUntil = shortText(form, 'validUntil');
    const sourceUrl = shortText(form, 'sourceUrl');
    if (title.length < 2 || title.length > 180) throw new KnowledgeError('标题应为 2 至 180 字', 400);
    if (version.length > 60 || !version) throw new KnowledgeError('版本信息过长', 400);
    if (!date.safeParse(validFrom).success || !date.safeParse(validUntil).success || validFrom && validUntil && validFrom > validUntil) throw new KnowledgeError('有效日期无效', 400);
    if (sourceUrl && (!/^https:\/\//i.test(sourceUrl) || sourceUrl.length > 500)) throw new KnowledgeError('来源链接必须是 HTTPS 地址', 400);
    const candidate = form.get('file');
    const pasted = shortText(form, 'text');
    if (candidate && !(candidate instanceof File)) throw new KnowledgeError('文件格式无效', 400);
    const file = candidate instanceof File ? candidate : null;
    if (!file && (pasted.length < 30 || pasted.length > 50000)) throw new KnowledgeError('文本需在 30 至 50000 字之间', 400);
    const sections = file ? await extractKnowledgeFile(file) : [{ section: '正文', text: pasted }];
    const chunks = chunkKnowledge(sections);
    const id = crypto.randomUUID();
    if (file) {
      const safeName = file.name.replace(/[^\w.\u3400-\u9fff-]/g, '_').slice(0, 120);
      storagePath = `${id}/${safeName}`;
      const mime = file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : file.name.toLowerCase().endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : file.name.toLowerCase().endsWith('.md') ? 'text/markdown' : 'text/plain';
      const uploaded = await client.storage.from('assistant-knowledge').upload(storagePath, Buffer.from(await file.arrayBuffer()), { upsert: false, contentType: mime });
      if (uploaded.error) throw new KnowledgeError('原件存储失败；请确认已运行资料库迁移', 503);
    }
    const inserted = await client.from('assistant_knowledge_documents').insert({ id, title, version, visibility,
      park_name: visibility === 'public' ? null : actor.park, company_user_id: visibility === 'enterprise' ? actor.userId : null,
      file_name: file?.name ?? '手动录入', storage_path: storagePath,
      source_url: sourceUrl || null, valid_from: validFrom || null, valid_until: validUntil || null,
      content: sections.map(s => `${s.section}\n${s.text}`).join('\n\n'), uploaded_by: actor.userId,
    });
    if (inserted.error) { if (storagePath) await client.storage.from('assistant-knowledge').remove([storagePath]); throw new KnowledgeError('资料表尚未配置或保存失败；请先运行数据库迁移', 503); }
    const indexed = await client.from('assistant_knowledge_chunks').insert(chunks.map(chunk => ({ document_id: id, ...chunk })));
    if (indexed.error) {
      await client.from('assistant_knowledge_documents').delete().eq('id', id);
      if (storagePath) await client.storage.from('assistant-knowledge').remove([storagePath]);
      throw new KnowledgeError('资料分段保存失败，请重试', 503);
    }
    return NextResponse.json({ id, status: 'pending', chunkCount: chunks.length, preview: chunks.slice(0, 3), note: actor.role === 'enterprise' ? '已提交，管理员审核后小水滴才能检索' : '已保存，请检查提取内容后发布' }, { headers: noStore });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const actor = await knowledgeActor(request);
    if (actor.role !== 'admin') throw new KnowledgeError('仅管理员可审核资料', 403);
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) throw new KnowledgeError('审核参数无效', 400);
    const client = knowledgeAdminClient();
    const { id, action, note } = parsed.data;
    if (action === 'reject' && !note?.trim()) throw new KnowledgeError('请填写退回原因', 400);
    const { data: doc, error } = await client.from('assistant_knowledge_documents').select('*').eq('id', id).single();
    if (error || !doc || !canReviewKnowledge(actor)) throw new KnowledgeError('资料不存在或无权管理', 404);
    if ((action === 'archive' || action === 'reindex') && doc.status !== 'published' ||
      (action === 'approve' || action === 'reject') && doc.status !== 'pending') throw new KnowledgeError('当前资料状态无法执行此操作', 409);
    let embeddingStatus: 'hybrid' | 'keyword' = doc.embedding_status;
    if (action === 'approve' || action === 'reindex') embeddingStatus = await indexKnowledgeDocument(client, id);
    const status = action === 'approve' ? 'published' : action === 'reject' ? 'rejected' : action === 'archive' ? 'archived' : doc.status;
    const saved = await client.from('assistant_knowledge_documents').update({ status, embedding_status: embeddingStatus, review_note: note ?? null,
      reviewed_by: actor.userId, reviewed_at: new Date().toISOString() }).eq('id', id).eq('status', doc.status).select('id').single();
    if (saved.error || !saved.data) throw new KnowledgeError('审核状态已变化，请刷新后重试', 409);
    return NextResponse.json({ id, status, embeddingStatus, note: (action === 'approve' || action === 'reindex') && embeddingStatus === 'keyword' ? '向量接口暂不可用，当前使用关键词检索' : undefined }, { headers: noStore });
  } catch (error) { return failure(error); }
}
