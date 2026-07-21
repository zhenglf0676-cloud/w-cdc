import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient } from '@/storage/database/supabase-client';

// 使用 service role key 绕过 RLS
function getSupabaseAdmin() {
  const { url, anonKey } = getSupabaseCredentials();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(url, serviceRoleKey || anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET /api/enterprise/monitoring/history - 获取历史监测数据
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-session');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const client = getSupabaseClient(token);
    const { data: { user }, error: authError } = await client.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get('outletId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const days = parseInt(searchParams.get('days') || '1');

    if (!outletId) {
      return NextResponse.json(
        { error: '缺少排污口 ID' },
        { status: 400 }
      );
    }

    // 验证排污口是否属于当前企业
    const { data: outlet } = await supabase
      .from('discharge_outlets')
      .select('id')
      .eq('id', outletId)
      .eq('user_id', user.id)
      .single();

    if (!outlet) {
      return NextResponse.json(
        { error: '排污口不存在或不属于当前企业' },
        { status: 404 }
      );
    }

    // 计算时间范围
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString();

    // 获取历史数据
    const { data: historyData, count } = await supabase
      .from('monitoring_data')
      .select('*', { count: 'exact' })
      .eq('outlet_id', outletId)
      .gte('monitored_at', startDateStr)
      .order('monitored_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    return NextResponse.json({
      success: true,
      data: historyData || [],
      total: count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('获取历史监测数据异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
