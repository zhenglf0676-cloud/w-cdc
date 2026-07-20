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

// GET /api/enterprise/monitoring/realtime - 获取实时监测数据
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

    // 获取每个污染物的最新监测数据
    const { data: latestData } = await supabase
      .from('monitoring_data')
      .select('*')
      .eq('outlet_id', outletId)
      .order('monitored_at', { ascending: false });

    // 按污染物类型分组，取每个类型的最新记录
    const latestByPollutant: Record<string, any> = {};
    if (latestData && Array.isArray(latestData)) {
      latestData.forEach((record: any) => {
        if (!latestByPollutant[record.pollutant_type]) {
          latestByPollutant[record.pollutant_type] = record;
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: latestByPollutant,
    });
  } catch (error) {
    console.error('获取实时监测数据异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
