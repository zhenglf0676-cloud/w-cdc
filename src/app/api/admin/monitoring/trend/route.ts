import { NextResponse } from 'next/server';
import { getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient } from '@/storage/database/supabase-client';
import { createClient } from '@supabase/supabase-js';

// 获取 Supabase 管理员客户端
function getSupabaseAdmin() {
  const credentials = getSupabaseCredentials();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(credentials.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: Request) {
  try {
    const token = request.headers.get('x-auth-token');
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 验证用户身份
    const client = getSupabaseClient(token);
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '无效的认证信息' }, { status: 401 });
    }

    // 使用 service role key 进行后续操作
    const supabase = getSupabaseAdmin();

    // 获取管理员信息
    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .select('id, park_name')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (adminError || !adminProfile) {
      return NextResponse.json({ error: '非管理员用户' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const enterpriseId = searchParams.get('enterpriseId');
    const days = parseInt(searchParams.get('days') || '7');

    if (!enterpriseId) {
      return NextResponse.json({ error: '缺少企业 ID' }, { status: 400 });
    }

    // 验证企业属于该管理员的园区
    const { data: enterprise, error: enterpriseError } = await supabase
      .from('profiles')
      .select('id, company_name, user_id')
      .eq('id', enterpriseId)
      .eq('park_name', adminProfile.park_name)
      .single();

    if (enterpriseError || !enterprise) {
      return NextResponse.json({ error: '企业不存在或不属于该园区' }, { status: 404 });
    }

    // 获取企业的排污口
    const { data: outlets, error: outletsError } = await supabase
      .from('discharge_outlets')
      .select('id, name')
      .eq('user_id', enterprise.user_id)
      .eq('status', 'approved');

    if (outletsError || !outlets || outlets.length === 0) {
      return NextResponse.json({ trendData: [] });
    }

    const outletIds = outlets.map(o => o.id);

    // 获取时间范围内的监测数据（与企业端 CDC API 保持一致）
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    startDate.setUTCHours(0, 0, 0, 0);
    now.setUTCHours(23, 59, 59, 999);

    const { data: monitoringData, error: dataError } = await supabase
      .from('monitoring_data')
      .select('id, outlet_id, pollutant_type, value, monitored_at')
      .in('outlet_id', outletIds)
      .gte('monitored_at', startDate.toISOString())
      .lte('monitored_at', now.toISOString())
      .order('monitored_at', { ascending: true });

    if (dataError) {
      console.error('获取监测数据失败:', dataError);
      return NextResponse.json({ trendData: [] });
    }

    if (!monitoringData || monitoringData.length === 0) {
      return NextResponse.json({ trendData: [] });
    }

    // 获取企业的污染物阈值
    const { data: applications } = await supabase
      .from('pollutant_applications')
      .select('pollutants')
      .eq('company_id', enterpriseId)
      .eq('status', 'approved');

    const thresholdMap = new Map<string, number>();
    if (applications && applications.length > 0) {
      for (const app of applications) {
        const pollutants = app.pollutants;
        if (Array.isArray(pollutants)) {
          for (const p of pollutants) {
            if (p.id && p.threshold) {
              thresholdMap.set(p.id, p.threshold);
            }
          }
        }
      }
    }

    // 按污染物类型分组
    const pollutantMap = new Map<string, {
      name: string;
      outlets: Map<string, { name: string; data: { time: string; value: number }[] }>;
    }>();

    for (const record of monitoringData) {
      const pollutantType = record.pollutant_type;
      const outletId = record.outlet_id;
      const outlet = outlets.find(o => o.id === outletId);
      if (!outlet) continue;

      if (!pollutantMap.has(pollutantType)) {
        pollutantMap.set(pollutantType, {
          name: pollutantType,
          outlets: new Map(),
        });
      }

      const pollutantData = pollutantMap.get(pollutantType)!;
      if (!pollutantData.outlets.has(outletId)) {
        pollutantData.outlets.set(outletId, {
          name: outlet.name,
          data: [],
        });
      }

      const outletData = pollutantData.outlets.get(outletId)!;
      outletData.data.push({
        time: new Date(record.monitored_at).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        value: record.value,
      });
    }

    // 转换为数组格式，添加阈值信息
    const trendData = Array.from(pollutantMap.entries()).map(([type, data]) => ({
      pollutantType: type,
      name: type,
      threshold: thresholdMap.get(type) || 0,
      outlets: Array.from(data.outlets.entries()).map(([id, outletData]) => ({
        outletId: id,
        outletName: outletData.name,
        data: outletData.data,
      })),
    }));

    return NextResponse.json({ trendData });
  } catch (error) {
    console.error('趋势数据 API 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
