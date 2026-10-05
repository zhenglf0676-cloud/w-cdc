import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { reportData, ReportError } from './data';
import { buildWord } from './word';
import type { Role } from './model';
export async function wordResponse(request: Request, role: Role) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const token = request.headers.get('x-auth-token');
  if (!token) return NextResponse.json({ error: '请先登录' }, { status: 401, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: '请求格式错误' }, { status: 400, headers }); }
  if (!body || typeof body !== 'object' || !('startDate' in body) || !('endDate' in body)) return NextResponse.json({ error: '请选择起止日期' }, { status: 400, headers });
  try {
    const model = await reportData(getSupabaseClient(), token, role, body.startDate, body.endDate);
    const buffer = await buildWord(model);
    return new Response(new Uint8Array(buffer), { headers: { ...headers, 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="water-report-${model.start}-${model.end}.docx"` } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ReportError ? error.message : '报告生成失败，请稍后重试' }, { status: error instanceof ReportError ? error.status : 500, headers });
  }
}
