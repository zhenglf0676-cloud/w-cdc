import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const sessionHeader = request.headers.get('x-session');
    if (!sessionHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const session = JSON.parse(sessionHeader);
    if (!session?.access_token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { url } = getSupabaseCredentials();
    const serviceRoleKey = getSupabaseServiceRoleKey();
    const db = createClient(url, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { count, error } = await db
      .from('pollutant_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) {
      console.error('获取待审批数量失败:', error);
      return NextResponse.json({ error: '获取失败' }, { status: 500 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('获取待审批数量异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
