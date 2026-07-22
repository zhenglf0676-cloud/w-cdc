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
      .select('id, user_id, company_name, park_name')
      .eq('role', 'enterprise')
      .eq('park_name', profile.park_name);

    if (enterprisesError) {
      return NextResponse.json({ error: '企业列表获取失败' }, { status: 500 });
    }

    // 为每个企业计算 CDC 值（简化版：使用最近的监测数据平均值）
    const rankingData = [];
    
    for (const enterprise of enterprises) {
      // 获取企业的排污口
      const { data: outlets } = await client
        .from('discharge_outlets')
        .select('id')
        .eq('company_id', enterprise.id)
        .eq('status', 'approved');

      if (!outlets || outlets.length === 0) {
        continue;
      }

      // 获取最近的监测数据
      const { data: monitoringData } = await client
        .from('monitoring_data')
        .select('value')
        .in('outlet_id', outlets.map(o => o.id))
        .order('monitored_at', { ascending: false })
        .limit(100);

      if (!monitoringData || monitoringData.length === 0) {
        continue;
      }

      // 计算平均浓度作为简化的 CDC 值
      const values = monitoringData.map(m => parseFloat(m.value)).filter(v => !isNaN(v));
      const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      
      // 简化的风险等级判定
      let riskLevel = '低风险';
      let riskColor = 'green';
      if (avgValue >= 1.5) {
        riskLevel = '高风险';
        riskColor = 'red';
      } else if (avgValue >= 0.5) {
        riskLevel = '中风险';
        riskColor = 'orange';
      }

      rankingData.push({
        enterpriseId: enterprise.id,
        userId: enterprise.user_id,
        companyName: enterprise.company_name,
        cdc: parseFloat(avgValue.toFixed(2)),
        riskLevel,
        riskColor,
        outletCount: outlets.length,
        monitoringCount: values.length
      });
    }

    // 按 CDC 值降序排列
    rankingData.sort((a, b) => b.cdc - a.cdc);

    return NextResponse.json({
      success: true,
      data: rankingData,
      parkName: profile.park_name,
      total: rankingData.length
    });

  } catch (error) {
    console.error('CDC 排行 API 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
