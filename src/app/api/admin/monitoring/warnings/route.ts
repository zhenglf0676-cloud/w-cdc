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

    const outletMap = new Map(outlets.map(o => [o.id, { name: o.name, userId: o.user_id }]));

    // 获取企业的污染物阈值（从 pollutant_applications）
    const { data: applications, error: appsError } = await supabase
      .from('pollutant_applications')
      .select('company_id, pollutants')
      .in('company_id', enterpriseIds)
      .eq('status', 'approved');

    if (appsError || !applications) {
      return NextResponse.json({ data: [] });
    }

    // 构建阈值映射：company_id -> { pollutant_type -> threshold }
    const companyThresholdMap = new Map();
    for (const app of applications) {
      const pollutants = app.pollutants || {};
      const thresholds: Record<string, number> = {};
      for (const [pollutantType, pollutantData] of Object.entries(pollutants)) {
        if (pollutantData && typeof pollutantData === 'object' && 'threshold' in (pollutantData as any)) {
          thresholds[pollutantType] = (pollutantData as any).threshold;
        }
      }
      companyThresholdMap.set(app.company_id, thresholds);
    }

    // 获取今天的监测数据（中国时间转换为 UTC）
    const now = new Date();
    // 中国时间今天 00:00 = UTC 时间昨天 16:00
    const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1, 16, 0, 0));
    // 中国时间今天 24:00 = UTC 时间今天 16:00
    const todayEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0));

    const { data: monitoringData, error: monitoringError } = await supabase
      .from('monitoring_data')
      .select('id, outlet_id, pollutant_type, value, monitored_at')
      .in('outlet_id', outlets.map(o => o.id))
      .gte('monitored_at', todayStart.toISOString())
      .lt('monitored_at', todayEnd.toISOString())
      .order('monitored_at', { ascending: false });

    if (monitoringError || !monitoringData) {
      console.log('监测数据查询失败:', monitoringError);
      return NextResponse.json({ data: [] });
    }
    console.log('监测数据数量:', monitoringData.length);

    // 按排污口和时间分组，检查每个记录是否有超标的污染物
    const groupedData = new Map<string, any>();
    
    for (const record of monitoringData) {
      const outlet = outletMap.get(record.outlet_id);
      if (!outlet) continue;

      // 找到对应的企业
      const enterprise = enterprises.find(e => e.user_id === outlet.userId);
      if (!enterprise) continue;

      // 获取该企业的阈值
      const thresholds = companyThresholdMap.get(enterprise.id) || {};
      const threshold = thresholds[record.pollutant_type];

      // 检查是否超过阈值
      if (threshold && record.value > threshold) {
        // 使用 monitored_at 作为分组键
        const timeKey = record.monitored_at;
        const groupKey = `${outlet.id}_${timeKey}`;
        
        if (!groupedData.has(groupKey)) {
          groupedData.set(groupKey, {
            time: record.monitored_at,
            enterpriseName: enterprise.company_name,
            outletName: outlet.name,
            pollutants: {},
          });
        }

        const group = groupedData.get(groupKey);
        group.pollutants[record.pollutant_type] = {
          value: record.value,
          threshold: threshold,
        };
      }
    }

    // 转换为数组并按时间排序
    const warnings = Array.from(groupedData.values())
      .filter(w => Object.keys(w.pollutants).length > 0)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return NextResponse.json({ data: warnings });
  } catch (error: any) {
    return NextResponse.json(
      { error: '预警记录 API 错误', detail: error.message },
      { status: 500 }
    );
  }
}
