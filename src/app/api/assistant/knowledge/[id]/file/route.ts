import { NextResponse } from 'next/server';
import { canOpenKnowledge, knowledgeActor, knowledgeAdminClient, KnowledgeError } from '@/lib/water-assistant/knowledge-auth';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await knowledgeActor(request);
    const client = knowledgeAdminClient();
    const { id } = await params;
    const { data: doc } = await client.from('assistant_knowledge_documents').select('*').eq('id', id).single();
    if (!doc || !canOpenKnowledge(actor, doc) || !doc.storage_path) throw new KnowledgeError('文件不存在或无权查看', 404);
    const { data, error } = await client.storage.from('assistant-knowledge').download(doc.storage_path);
    if (error || !data) throw new KnowledgeError('文件暂时无法下载', 503);
    const extension = doc.file_name.toLowerCase().split('.').at(-1);
    const mime = extension === 'pdf' ? 'application/pdf' : extension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain; charset=utf-8';
    const safeName = doc.file_name.replace(/[\r\n"\\]/g, '_');
    return new Response(data.stream(), { headers: { 'Content-Type': mime, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`, 'Cache-Control': 'private, no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof KnowledgeError ? error.message : '下载失败' }, { status: error instanceof KnowledgeError ? error.status : 503 }); }
}
