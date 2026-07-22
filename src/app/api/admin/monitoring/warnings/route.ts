import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('x-auth-token');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const supabase = getSupabaseClient(authHeader);

    // 获取当前用户信息
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '用户信息获取失败' }, { status: 400 });
    }

    // 获取管理员信息
    const { data: admin, error: adminError } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, company_name, park_name, role')
      .eq('user_id', user.id)
      .single();

    if (adminError || !admin) {
      return NextResponse.json({ error: '管理员信息获取失败' }, { status: 400 });
    }

    if (admin.role !== 'admin') {
      return NextResponse.json({ error: '非管理员用户' }, { status: 403 });
    }

    const parkName = admin.park_name;
    if (!parkName) {
      return NextResponse.json({ error: '管理员未绑定园区' }, { status: 400 });
    }

    // 获取园区内所有企业
    const { data: enterprises, error: enterprisesError } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, company_name')
      .eq('park_name', parkName)
      .eq('role', 'enterprise');

    if (enterprisesError || !enterprises || enterprises.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const enterpriseIds = enterprises.map(e => e.id);
    const userIds = enterprises.map(e => e.user_id);

    // 获取企业的排污口
    const { data: outlets, error: outletsError } = await supabase
      .from('discharge_outlets')
      .select('id, name, user_id')
      .in('user_id', userIds)
      .eq('status', 'approved');

    if (outletsError || !outlets || outlets.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const outletIds = outlets.map(o => o.id);
    const outletMap = new Map(outlets.map(o => [o.id, { name: o.name, userId: o.user_id }]));

    // 获取企业的污染物阈值
    const { data: applications, error: appsError } = await supabase
      .from('pollutant_applications')
      .select('company_id, pollutants')
      .in('company_id', enterpriseIds)
      .eq('status', 'approved');

    if (appsError || !applications) {
      return NextResponse.json({ data: [] });
    }

    // 构建阈值映射：outlet_id -> { pollutant_type -> threshold }
    const thresholdMap = new Map();
    for (const app of applications) {
      const pollutants = app.pollutants || {};
      // 找到该企业的所有排污口
      const enterpriseOutlets = outlets.filter(o => {
        const enterprise = enterprises.find(e => e.user_id === o.user_id);
        return enterprise && enterprise.id === app.company_id;
      });

      for (const outlet of enterpriseOutlets) {
        const outletThresholds: Record<string, number> = {};
        for (const [pollutantType, pollutantData] of Object.entries(pollutants)) {
          if (pollutantData && typeof pollutantData === 'object' && 'threshold' in (pollutantData as any)) {
            outletThresholds[pollutantType] = (pollutantData as any).threshold;
          }
        }
        thresholdMap.set(outlet.id, outletThresholds);
      }
    }

    // 获取最近的监测数据（每个排污口每个污染物的最新记录）
    const { data: monitoringData, error: monitoringError } = await supabase
      .from('monitoring_data')
      .select('id, outlet_id, pollutant_type, value, monitored_at')
      .in('outlet_id', outletIds)
      .order('monitored_at', { ascending: false })
      .limit(1000);

    if (monitoringError || !monitoringData || monitoringData.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 按排污口和时间分组，检查是否有超过阈值的记录
    const recordMap = new Map(); // key: "outlet_id_time" -> { outlet, time, values, hasWarning }

    for (const record of monitoringData) {
      const outlet = outletMap.get(record.outlet_id);
      if (!outlet) continue;

      const thresholds = thresholdMap.get(record.outlet_id) || {};
      const threshold = thresholds[record.pollutant_type];

      // 检查是否超过阈值
      const isExceeded = threshold !== undefined && record.value > threshold;

      const key = `${record.outlet_id}_${record.monitored_at}`;
      if (!recordMap.has(key)) {
        const enterprise = enterprises.find(e => e.user_id === outlet.userId);
        recordMap.set(key, {
          outletId: record.outlet_id,
          outletName: outlet.name,
          enterpriseId: enterprise?.id,
          enterpriseName: enterprise?.company_name || enterprise?.full_name || '未知企业',
          time: record.monitored_at,
          values: {},
          hasWarning: false,
        });
      }

      const entry = recordMap.get(key);
      entry.values[record.pollutant_type] = record.value;

      // 如果有任何污染物超过阈值，标记为有预警
      if (isExceeded) {
        entry.hasWarning = true;
      }
    }

    // 只返回有预警的记录
    const warnings = Array.from(recordMap.values())
      .filter(entry => entry.hasWarning)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 50);

    console.log(`预警记录数量：${warnings.length}`);

    return NextResponse.json({ data: warnings });
  } catch (error) {
    console.error('预警记录 API 错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误', detail: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
