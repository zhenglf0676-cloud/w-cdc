import { NextResponse } from 'next/server';
import { createClient } from '@/storage/database/supabase-client';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('x-auth-token');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const supabase = createClient();

    // 获取当前用户信息
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader);
    if (userError || !user) {
      return NextResponse.json({ error: '用户信息获取失败' }, { status: 400 });
    }

    // 获取管理员信息
    const { data: admin, error: adminError } = await supabase
      .from('profiles')
      .select('id, user_id, park_name, role')
      .eq('user_id', user.id)
      .single();

    if (adminError || !admin || admin.role !== 'admin') {
      return NextResponse.json({ error: '非管理员用户' }, { status: 403 });
    }

    // 获取园区内所有企业
    const { data: enterprises, error: enterprisesError } = await supabase
      .from('profiles')
      .select('id, user_id, company_name')
      .eq('park_name', admin.park_name)
      .eq('role', 'enterprise');

    if (enterprisesError) {
      console.error('获取企业列表错误:', enterprisesError);
      return NextResponse.json({ error: '获取企业列表失败' }, { status: 500 });
    }

    if (!enterprises || enterprises.length === 0) {
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

    if (outletsError) {
      console.error('获取排污口错误:', outletsError);
      return NextResponse.json({ error: '获取排污口失败' }, { status: 500 });
    }

    if (!outlets || outlets.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const outletIds = outlets.map(o => o.id);
    const outletMap = new Map(outlets.map(o => [o.id, o.name]));

    // 获取企业的污染物申请和阈值
    const { data: applications, error: appsError } = await supabase
      .from('pollutant_applications')
      .select('company_id, pollutants')
      .in('company_id', enterpriseIds)
      .eq('status', 'approved');

    if (appsError) {
      console.error('获取污染物申请错误:', appsError);
      return NextResponse.json({ error: '获取污染物申请失败' }, { status: 500 });
    }

    // 构建污染物阈值映射
    const thresholdMap = new Map<string, { threshold: number; name: string }>();
    if (applications) {
      for (const app of applications) {
        const pollutants = app.pollutants as Record<string, { threshold: number; unit: string }>;
        if (pollutants) {
          for (const [pollutantId, config] of Object.entries(pollutants)) {
            thresholdMap.set(pollutantId, {
              threshold: config.threshold,
              name: pollutantId
            });
          }
        }
      }
    }

    console.log('阈值映射:', Array.from(thresholdMap.entries()));

    // 获取所有监测数据中超过阈值的记录
    const { data: monitoringData, error: monitoringError } = await supabase
      .from('monitoring_data')
      .select('id, outlet_id, pollutant_type, value, monitored_at')
      .in('outlet_id', outletIds)
      .order('monitored_at', { ascending: false })
      .limit(100);

    if (monitoringError) {
      console.error('获取监测数据错误:', monitoringError);
      return NextResponse.json({ error: '获取监测数据失败' }, { status: 500 });
    }

    console.log('监测数据数量:', monitoringData?.length || 0);

    // 筛选超过阈值的记录
    const warnings = (monitoringData || [])
      .filter(record => {
        const thresholdInfo = thresholdMap.get(record.pollutant_type);
        return thresholdInfo && record.value > thresholdInfo.threshold;
      })
      .map(record => {
        const outletName = outletMap.get(record.outlet_id) || '未知排污口';
        const enterprise = enterprises.find(e => 
          outlets.find(o => o.id === record.outlet_id && o.user_id === e.user_id)
        );
        const thresholdInfo = thresholdMap.get(record.pollutant_type);

        return {
          warningTime: record.monitored_at,
          enterpriseName: enterprise?.company_name || '未知企业',
          outletName: outletName,
          pollutantName: record.pollutant_type,
          warningValue: record.value,
          threshold: thresholdInfo?.threshold || 0,
          riskLevel: '超标',
          status: '未处理'
        };
      });

    console.log('预警记录数量:', warnings.length);

    return NextResponse.json({ data: warnings });
  } catch (error) {
    console.error('预警记录 API 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
