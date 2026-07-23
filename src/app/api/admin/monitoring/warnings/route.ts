import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 今日超标预警记录
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-auth-token');
    const supabase = getSupabaseClient(token || undefined);

    // 获取今天的开始时间
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

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
      .gte('monitored_at', todayStart)
      .neq('status', 'normal')
      .order('monitored_at', { ascending: false });

    if (warningError || !warningRecords || warningRecords.length === 0) {
      console.log('今日无超标记录');
      return NextResponse.json({ data: [] });
    }

    console.log('今日超标记录数量:', warningRecords.length);

    // 获取所有相关的排污口ID
    const outletIds = [...new Set(warningRecords.map((r: { outlet_id: string }) => r.outlet_id))];

    // 查询排污口信息
    const { data: outlets } = await supabase
      .from('discharge_outlets')
      .select('id, name, user_id')
      .in('id', outletIds);

    if (!outlets || outlets.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 创建排污口映射
    const outletMap = new Map(outlets.map((o: { id: string; name: string; user_id: string }) => [o.id, o]));

    // 获取所有相关的企业ID
    const userIds = [...new Set(outlets.map((o: { user_id: string }) => o.user_id))];

    // 查询企业信息
    const { data: enterprises } = await supabase
      .from('profiles')
      .select('id, user_id, company_name')
      .in('user_id', userIds);

    if (!enterprises || enterprises.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 创建企业映射
    const enterpriseMap = new Map(enterprises.map((e: { user_id: string; company_name: string }) => [e.user_id, e]));

    // 污染物名称映射
    const pollutantNameMap: Record<string, string> = {
      'cod': 'COD（化学需氧量）',
      'nh3n': 'NH₃-N（氨氮）',
      'tp': 'TP（总磷）',
      'tn': 'TN（总氮）'
    };

    // 构建返回数据
    const result = warningRecords.map((record: {
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
