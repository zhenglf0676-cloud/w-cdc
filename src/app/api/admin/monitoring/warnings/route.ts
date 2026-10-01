import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 今日超标预警记录
export async function GET(request: NextRequest) {
  try {
    // 使用服务角色密钥查询数据
    const supabase = getSupabaseClient();

    // 在服务角色查询监测记录前验证身份，并确定管理员所属园区。
    const token = request.headers.get('x-auth-token');
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, park_name')
      .eq('user_id', user.id)
      .single();
    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }
    if (!profile.park_name) {
      return NextResponse.json({ error: '未设置园区名称' }, { status: 400 });
    }

    const { data: enterprises, error: enterpriseError } = await supabase
      .from('profiles')
      .select('id, user_id, company_name')
      .eq('role', 'enterprise')
      .eq('park_name', profile.park_name);
    if (enterpriseError) throw enterpriseError;
    if (!enterprises || enterprises.length === 0) {
      return NextResponse.json({ data: [] });
    }
    const userIds = enterprises.map((e: { user_id: string }) => e.user_id);
    const { data: outlets, error: outletError } = await supabase
      .from('discharge_outlets')
      .select('id, name, user_id')
      .in('user_id', userIds);
    if (outletError) throw outletError;
    if (!outlets || outlets.length === 0) {
      return NextResponse.json({ data: [] });
    }
    const outletIds = outlets.map((o: { id: string }) => o.id);
    const outletMap = new Map(outlets.map((o: { id: string; name: string; user_id: string }) => [o.id, o]));
    const enterpriseMap = new Map(enterprises.map((e: { user_id: string; company_name: string }) => [e.user_id, e]));

    // 获取今天的开始时间（中国时间 UTC+8）
    const now = new Date();
    const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayStart = new Date(Date.UTC(chinaTime.getUTCFullYear(), chinaTime.getUTCMonth(), chinaTime.getUTCDate(), 0, 0, 0, 0)).toISOString();
    // 转换为UTC时间用于查询
    const todayStartUTC = new Date(new Date(todayStart).getTime() - 8 * 60 * 60 * 1000).toISOString();
    console.log('todayStart:', todayStart, 'todayStartUTC:', todayStartUTC);

    // 直接查询今日超标的监测数据
    const { data: warningRecords, error: warningError } = await supabase
      .from('monitoring_data')
      .select(`
        id,
        outlet_id,
        pollutant_type,
        value,
        status,
        standard_limit,
        monitored_at
      `)
      .in('outlet_id', outletIds)
      .gte('monitored_at', todayStartUTC)
      .neq('status', 'normal')
      .order('monitored_at', { ascending: false });

    console.log('查询条件:', { todayStartUTC, status: 'normal' });
    console.log('warningError:', warningError);
    console.log('warningRecords:', warningRecords?.length);

    if (warningError || !warningRecords || warningRecords.length === 0) {
      console.log('今日无超标记录');
      return NextResponse.json({ data: [] });
    }

    console.log('今日超标记录数量:', warningRecords.length);

    // 污染物名称映射
    const pollutantNameMap: Record<string, string> = {
      'cod': 'COD（化学需氧量）',
      'nh3n': 'NH₃-N（氨氮）',
      'tp': 'TP（总磷）',
      'tn': 'TN（总氮）'
    };

    // 构建返回数据
    const result = warningRecords.filter((record: { value: number; standard_limit: number | null }) =>
      record.standard_limit != null && Number(record.value) > Number(record.standard_limit)
    ).map((record: {
      id: string;
      outlet_id: string;
      pollutant_type: string;
      value: number;
      status: string;
      standard_limit: number | null;
      monitored_at: string;
    }) => {
      const outlet = outletMap.get(record.outlet_id);
      const enterprise = outlet ? enterpriseMap.get(outlet.user_id) : null;
      
      return {
        id: record.id,
        enterpriseName: enterprise?.company_name || '未知企业',
        outletName: outlet?.name || '未知排污口',
        pollutantType: record.pollutant_type,
        pollutantName: pollutantNameMap[record.pollutant_type] || record.pollutant_type,
        value: record.value,
        standardLimit: record.standard_limit || 0,
        status: record.status,
        monitoredAt: record.monitored_at
      };
    });

    console.log('返回预警记录数量:', result.length);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('获取预警记录失败:', error);
    return NextResponse.json({ data: [] });
  }
}
