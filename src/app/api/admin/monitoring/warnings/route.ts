import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    // 获取认证 token
    const token = request.headers.get('x-auth-token');
    if (!token) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    // 创建 Supabase 客户端
    const client = getSupabaseClient(token);
    
    // 获取当前用户信息
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: '用户信息获取失败' }, { status: 400 });
    }

    // 获取管理员的园区信息
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('park_name')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: '管理员信息获取失败' }, { status: 400 });
    }

    // 获取园区内所有企业
    const { data: enterprises, error: enterprisesError } = await client
      .from('profiles')
      .select('id, company_name')
      .eq('role', 'enterprise')
      .eq('park_name', profile.park_name);

    if (enterprisesError) {
      return NextResponse.json({ error: '企业列表获取失败' }, { status: 500 });
    }

    const enterpriseIds = enterprises.map(e => e.id);
    const enterpriseMap = new Map(enterprises.map(e => [e.id, e.company_name]));

    // 获取所有排污口
    const { data: outlets, error: outletsError } = await client
      .from('discharge_outlets')
      .select('id, outlet_name, company_id')
      .in('company_id', enterpriseIds)
      .eq('status', 'approved');

    if (outletsError) {
      return NextResponse.json({ error: '排污口列表获取失败' }, { status: 500 });
    }

    const outletIds = outlets.map(o => o.id);
    const outletMap = new Map(outlets.map(o => [o.id, { name: o.outlet_name, companyId: o.company_id }]));

    // 获取所有已审批的污染物申请（包含阈值）
    const { data: pollutantApplications, error: pollutantsError } = await client
      .from('pollutant_applications')
      .select('id, pollutants, company_id')
      .in('company_id', enterpriseIds)
      .eq('status', 'approved');

    if (pollutantsError) {
      return NextResponse.json({ error: '污染物列表获取失败' }, { status: 500 });
    }

    // 构建污染物映射（从 pollutants JSON 字段解析）
    const pollutantMap = new Map<string, any>();
    pollutantApplications?.forEach(app => {
      if (app.pollutants && Array.isArray(app.pollutants)) {
        app.pollutants.forEach((p: any) => {
          if (p.id) {
            pollutantMap.set(p.id, {
              id: p.id,
              pollutant_name: p.label || p.id,
              warning_threshold: p.warningThreshold || p.warning_threshold,
              alarm_threshold: p.alarmThreshold || p.alarm_threshold,
              unit: p.unit || 'mg/L',
              company_id: app.company_id
            });
          }
        });
      }
    });

    // 获取最近的监测数据（用于检测预警）
    const { data: monitoringData, error: monitoringError } = await client
      .from('monitoring_data')
      .select('id, outlet_id, pollutant_id, value, monitored_at')
      .in('outlet_id', outletIds)
      .order('monitored_at', { ascending: false })
      .limit(500);

    if (monitoringError) {
      return NextResponse.json({ error: '监测数据获取失败' }, { status: 500 });
    }

    // 生成预警记录
    const warnings = [];
    
    for (const record of monitoringData) {
      const outlet = outletMap.get(record.outlet_id);
      if (!outlet) continue;

      const pollutant = pollutantMap.get(record.pollutant_id);
      if (!pollutant) continue;

      const value = parseFloat(record.value);
      if (isNaN(value)) continue;

      let warningLevel = null;
      let warningType = null;

      // 检查是否超过报警阈值
      if (pollutant.alarm_threshold && value >= parseFloat(pollutant.alarm_threshold)) {
        warningLevel = '高风险';
        warningType = '超报警';
      }
      // 检查是否超过预警阈值
      else if (pollutant.warning_threshold && value >= parseFloat(pollutant.warning_threshold)) {
        warningLevel = '中风险';
        warningType = '超预警';
      }

      if (warningLevel) {
        warnings.push({
          id: record.id,
          time: record.monitored_at,
          companyName: enterpriseMap.get(outlet.companyId) || '未知企业',
          outletName: outlet.name,
          indicator: pollutant.pollutant_name,
          value: `${value} mg/L (${warningType})`,
          cdc: 0, // 简化：实际应该计算 CDC
          level: warningLevel,
          status: '未处理'
        });
      }
    }

    // 按时间降序排列
    warnings.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return NextResponse.json({
      success: true,
      data: warnings.slice(0, 50), // 返回最近 50 条
      parkName: profile.park_name,
      total: warnings.length
    });

  } catch (error) {
    console.error('预警记录 API 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
