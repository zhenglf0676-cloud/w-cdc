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

    // 获取时间范围内的监测数据
    const now = new Date();
    const startDate = new Date(now);
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - days + 1);

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

    // 获取污染物阈值
    const { data: applications, error: appError } = await supabase
      .from('pollutant_applications')
      .select('pollutants')
      .eq('company_id', enterprise.id)
      .eq('status', 'approved');

    const pollutantThresholds: Record<string, { threshold: number }> = {};
    if (!appError && applications && applications.length > 0) {
      for (const app of applications) {
        const pollutants = app.pollutants as Array<{ id: string; threshold: number }>;
        if (Array.isArray(pollutants)) {
          for (const p of pollutants) {
            if (p.id && p.threshold) {
              pollutantThresholds[p.id] = { threshold: p.threshold };
            }
          }
        }
      }
    }

    // 按污染物类型和日期分组数据
    const groupedData: Record<string, Record<string, number[]>> = {};
    for (const record of monitoringData) {
      const pollutantType = record.pollutant_type;
      const date = new Date(record.monitored_at).toISOString().split('T')[0];
      
      if (!groupedData[pollutantType]) {
        groupedData[pollutantType] = {};
      }
      if (!groupedData[pollutantType][date]) {
        groupedData[pollutantType][date] = [];
      }
      groupedData[pollutantType][date].push(record.value);
    }

    // 计算每日平均值
    const trendData: Array<{
      pollutantName: string;
      dates: string[];
      values: number[];
      threshold: number;
    }> = [];

    for (const [pollutantName, dateValues] of Object.entries(groupedData)) {
      const dates = Object.keys(dateValues).sort();
      const values = dates.map(date => {
        const vals = dateValues[date];
        return vals.reduce((sum, v) => sum + v, 0) / vals.length;
      });

      trendData.push({
        pollutantName,
        dates,
        values,
        threshold: pollutantThresholds[pollutantName]?.threshold || 0,
      });
    }

    return NextResponse.json({ trendData });
  } catch (error) {
    console.error('指标趋势 API 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
