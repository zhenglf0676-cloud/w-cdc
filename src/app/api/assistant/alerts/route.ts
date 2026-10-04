import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { chinaDay, exceeded, type Reading } from '@/lib/water-reports/model';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const token = request.headers.get('x-auth-token');
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401, headers });
  try {
    const client = getSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: '未登录' }, { status: 401, headers });
    const { data: profile, error: pe } = await client.from('profiles').select('role, park_name').eq('user_id', user.id).single();
    if (pe || !profile || !['enterprise', 'admin'].includes(profile.role)) return NextResponse.json({ error: '无权限' }, { status: 403, headers });
    let users = [user.id];
    if (profile.role === 'admin') {
      if (!profile.park_name) return NextResponse.json({ error: '未配置园区' }, { status: 400, headers });
      users = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from('profiles').select('user_id').eq('role', 'enterprise').eq('park_name', profile.park_name).order('id').range(offset, offset + 499);
        if (error) throw error;
        users.push(...(data ?? []).map(p => p.user_id));
        if (!data || data.length < 500) break;
      }
    }
    const ids: string[] = [];
    for (let i = 0; i < users.length; i += 100) {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from('discharge_outlets').select('id').in('user_id', users.slice(i, i + 100)).eq('status', 'approved').order('id').range(offset, offset + 499);
        if (error) throw error;
        ids.push(...(data ?? []).map(o => o.id));
        if (!data || data.length < 500) break;
      }
    }
    const now = new Date().toISOString();
    const from = new Date(chinaDay(now) + 'T00:00:00+08:00').toISOString();
    const warnings: { id: string; at: string }[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from('monitoring_data').select('id, value, standard_limit, monitored_at').in('outlet_id', ids.slice(i, i + 100)).gte('monitored_at', from).lte('monitored_at', now).order('id').range(offset, offset + 499);
        if (error) throw error;
        for (const r of data ?? []) if (exceeded(r as Reading)) warnings.push({ id: r.id, at: r.monitored_at });
        if (!data || data.length < 500) break;
        if (offset >= 49500) throw new Error('数据量过大');
      }
    }
    return NextResponse.json({ warnings, role: profile.role }, { headers });
  } catch { return NextResponse.json({ error: '异常提醒暂不可用' }, { status: 503, headers }); }
}
