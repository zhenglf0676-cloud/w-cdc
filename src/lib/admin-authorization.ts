import { NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';

type AdminContext = { db: SupabaseClient; parkName: string; userId: string };
type AdminResult =
  | { ok: true; context: AdminContext }
  | { ok: false; response: NextResponse };

/** Check the session and the stored profile before making service-role queries. */
export async function requireParkAdmin(request: Request): Promise<AdminResult> {
  const token = request.headers.get('x-session');
  if (!token) return { ok: false, response: NextResponse.json({ error: '未登录' }, { status: 401 }) };
  if (!getSupabaseServiceRoleKey()) {
    return { ok: false, response: NextResponse.json({ error: '服务端权限未配置' }, { status: 503 }) };
  }

  const db = getSupabaseClient();
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: '登录已失效' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await db.from('profiles')
    .select('role,park_name').eq('user_id', user.id).single();
  if (profileError || profile?.role !== 'admin') {
    return { ok: false, response: NextResponse.json({ error: '需要管理员权限' }, { status: 403 }) };
  }
  if (!profile.park_name) {
    return { ok: false, response: NextResponse.json({ error: '管理员未设置所属园区' }, { status: 403 }) };
  }

  return { ok: true, context: { db, parkName: profile.park_name, userId: user.id } };
}
