import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-auth-token');
    if (!token) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const client = getSupabaseClient(token);
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

    // 获取企业 ID 参数
    const { searchParams } = new URL(request.url);
    const enterpriseId = searchParams.get('enterpriseId');

    if (!enterpriseId) {
      return NextResponse.json({ error: '缺少企业 ID' }, { status: 400 });
    }

    // 验证企业是否属于该园区
    const { data: enterprise } = await client
      .from('profiles')
      .select('id, company_name, user_id')
      .eq('id', enterpriseId)
      .eq('park_name', profile.park_name)
      .eq('role', 'enterprise')
      .single();

    if (!enterprise) {
      return NextResponse.json({ error: '企业不存在或不属于该园区' }, { status: 404 });
    }

    // 获取企业的排污口
    const { data: outlets } = await client
      .from('discharge_outlets')
      .select('id, name')
      .eq('user_id', enterprise.user_id)
      .eq('status', 'approved');

    if (!outlets || outlets.length === 0) {
      return NextResponse.json({ success: true, data: [], enterpriseName: enterprise.company_name });
    }

    const outletIds = outlets.map(o => o.id);

    // 获取每个排污口的最新监测数据
    const { data: monitoringData } = await client
      .from('monitoring_data')
      .select('*')
      .in('outlet_id', outletIds)
      .order('monitored_at', { ascending: false });

    if (!monitoringData || monitoringData.length === 0) {
      return NextResponse.json({ success: true, data: [], enterpriseName: enterprise.company_name });
    }

    // 按污染物类型分组，取每个类型的最新记录
    const latestByPollutant: Record<string, any> = {};
    monitoringData.forEach((record: any) => {
      if (!latestByPollutant[record.pollutant_type]) {
        latestByPollutant[record.pollutant_type] = record;
      }
    });

    // 获取污染物阈值信息
    const { data: pollutantApplications, error: pollError } = await client
      .from('pollutant_applications')
      .select('pollutants')
      .eq('company_id', enterpriseId)
      .eq('status', 'approved');

    if (pollError) {
      console.error('获取污染物申请失败:', pollError);
    }

    console.log('企业 ID:', enterpriseId);
    console.log('污染物申请数量:', pollutantApplications?.length || 0);

    const thresholdMap: Record<string, { threshold: number; unit: string }> = {};
    if (pollutantApplications) {
      pollutantApplications.forEach((app: any) => {
        if (app.pollutants && Array.isArray(app.pollutants)) {
          app.pollutants.forEach((p: any) => {
            if (p.id) {
              thresholdMap[p.id] = {
                threshold: p.threshold || 0,
                unit: p.unit || 'mg/L'
              };
            }
          });
        }
      });
    }

    console.log('阈值映射:', thresholdMap);

    // 污染物 ID 到中文名称的映射
    const pollutantNameMap: Record<string, string> = {
      'cod': 'COD（化学需氧量）',
      'nh3n': 'NH₃-N（氨氮）',
      'tp': 'TP（总磷）',
      'tn': 'TN（总氮）'
    };

    // 构建返回数据
    const result = Object.entries(latestByPollutant).map(([pollutantType, record]: [string, any]) => {
      const threshold = thresholdMap[pollutantType];
      const value = parseFloat(record.value);
      const thresholdValue = threshold?.threshold || 0;
      
      let status = 'normal';
      if (value >= thresholdValue) {
        status = 'alarm';
      } else if (value >= thresholdValue * 0.8) {
        status = 'warning';
      }

      return {
        name: pollutantNameMap[pollutantType] || pollutantType.toUpperCase(),
        unit: threshold?.unit || record.unit || 'mg/L',
        latestValue: value,
        status,
        warningThreshold: thresholdValue * 0.8,
        alarmThreshold: thresholdValue,
        monitoredAt: record.monitored_at
      };
    });

    console.log('返回数据:', result);

    return NextResponse.json({
      success: true,
      data: result,
      enterpriseName: enterprise.company_name
    });

  } catch (error) {
    console.error('获取企业监测数据错误:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ error: '服务器错误', detail: errorMessage }, { status: 500 });
  }
}
