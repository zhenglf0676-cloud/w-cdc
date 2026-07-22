import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient } from '@/storage/database/supabase-client';
import { createClient } from '@supabase/supabase-js';

// 使用 service role key 绕过 RLS
function getSupabaseAdmin() {
  const { url, anonKey } = getSupabaseCredentials();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(url, serviceRoleKey || anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// 获取风险等级
function getRiskLevel(cdc: number): { level: string; color: string } {
  if (cdc < 0.5) return { level: '低风险', color: 'green' };
  if (cdc < 1.5) return { level: '中风险', color: 'orange' };
  return { level: '高风险', color: 'red' };
}

export async function GET(request: NextRequest) {
  try {
    // 获取认证信息
    const token = request.headers.get('x-auth-token');
    if (!token) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    // 使用 token 验证用户身份
    const client = getSupabaseClient(token);
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: '用户信息获取失败' }, { status: 400 });
    }

    const userId = user.id;
    
    // 使用 service role key 进行后续操作
    const supabase = getSupabaseAdmin();

    // 获取管理员信息
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !adminProfile) {
      return NextResponse.json({ error: '管理员信息获取失败' }, { status: 400 });
    }

    if (adminProfile.role !== 'admin') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    const parkName = adminProfile.park_name;
    if (!parkName) {
      return NextResponse.json({ error: '管理员未绑定园区' }, { status: 400 });
    }

    // 获取园区内所有企业
    const { data: enterprises, error: enterprisesError } = await supabase
      .from('profiles')
      .select('id, user_id, username, email, company_name, industry, contact_person')
      .eq('park_name', parkName)
      .eq('role', 'enterprise');

    if (enterprisesError) {
      console.error('获取企业列表失败:', enterprisesError);
      return NextResponse.json({ error: '企业列表获取失败' }, { status: 500 });
    }

    if (!enterprises || enterprises.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // 获取时间范围参数
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 默认最近 7 天
    let fromDate: Date;
    let toDate: Date;

    if (startDate && endDate) {
      fromDate = new Date(startDate);
      toDate = new Date(endDate);
    } else {
      toDate = new Date();
      fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 为每个企业获取 CDC 值（调用企业端 CDC 分析 API 的逻辑）
    const ranking = [];

    for (const enterprise of enterprises) {
      try {
        // 获取企业的排污口
        const { data: outlets } = await supabase
          .from('discharge_outlets')
          .select('id, name')
          .eq('user_id', enterprise.user_id)
          .eq('status', 'approved');

        if (!outlets || outlets.length === 0) {
          ranking.push({
            enterpriseId: enterprise.id,
            enterpriseName: enterprise.company_name || enterprise.username || '未知企业',
            industry: enterprise.industry || '-',
            contactPerson: enterprise.contact_person || '-',
            totalOutlets: 0,
            totalPollutants: 0,
            overallCDC: 0,
            riskLevel: '低风险',
            riskColor: 'green'
          });
          continue;
        }

        const outletIds = outlets.map(o => o.id);

        // 获取企业的污染物
        const { data: pollutants } = await supabase
          .from('pollutant_applications')
          .select('*')
          .eq('company_id', enterprise.id)
          .eq('status', 'approved');

        if (!pollutants || pollutants.length === 0) {
          ranking.push({
            enterpriseId: enterprise.id,
            enterpriseName: enterprise.company_name || enterprise.username || '未知企业',
            industry: enterprise.industry || '-',
            contactPerson: enterprise.contact_person || '-',
            totalOutlets: outlets.length,
            totalPollutants: 0,
            overallCDC: 0,
            riskLevel: '低风险',
            riskColor: 'green'
          });
          continue;
        }

        // 解析污染物列表
        const pollutantList: { id: string; name: string; unit: string; threshold: number }[] = [];
        pollutants.forEach((app: any) => {
          if (Array.isArray(app.pollutants)) {
            app.pollutants.forEach((p: any) => {
              pollutantList.push({
                id: p.id,
                name: p.label || p.id,
                unit: p.unit || '',
                threshold: p.threshold || 0
              });
            });
          }
        });

        // 获取监测数据
        const { data: monitoringData } = await supabase
          .from('monitoring_data')
          .select('*')
          .in('outlet_id', outletIds)
          .gte('monitored_at', fromDate.toISOString())
          .lte('monitored_at', toDate.toISOString())
          .order('monitored_at', { ascending: true });

        if (!monitoringData || monitoringData.length === 0) {
          ranking.push({
            enterpriseId: enterprise.id,
            enterpriseName: enterprise.company_name || enterprise.username || '未知企业',
            industry: enterprise.industry || '-',
            contactPerson: enterprise.contact_person || '-',
            totalOutlets: outlets.length,
            totalPollutants: pollutantList.length,
            overallCDC: 0,
            riskLevel: '低风险',
            riskColor: 'green'
          });
          continue;
        }

        // 按污染物类型分组
        const pollutantDataMap: Record<string, number[]> = {};
        pollutantList.forEach(p => {
          pollutantDataMap[p.id] = [];
        });

        monitoringData.forEach(record => {
          if (pollutantDataMap[record.pollutant_type]) {
            pollutantDataMap[record.pollutant_type].push(record.value);
          }
        });

        // 计算每个污染物的基础统计指标
        const pollutantStats: Record<string, { av: number; ad: number; cv: number; skew: number }> = {};
        
        for (const pollutant of pollutantList) {
          const values = pollutantDataMap[pollutant.id];
          if (!values || values.length === 0) continue;

          const n = values.length;
          const av = values.reduce((a, b) => a + b, 0) / n;
          const ad = values.reduce((a, b) => a + Math.abs(b - av), 0) / n;
          
          // 计算标准差
          const squaredDiffs = values.map(v => Math.pow(v - av, 2));
          const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / n;
          const sd = Math.sqrt(avgSquaredDiff);
          
          const cv = av !== 0 ? sd / av : 0;
          
          // 计算偏度
          let skew = 0;
          if (sd !== 0 && n >= 3) {
            const cubedDiffs = values.map(v => Math.pow((v - av) / sd, 3));
            const sum = cubedDiffs.reduce((a, b) => a + b, 0);
            skew = (n / ((n - 1) * (n - 2))) * sum;
          }

          pollutantStats[pollutant.id] = { av, ad, cv, skew };
        }

        // 获取园区内所有企业的 AV 值（用于权重计算）
        const allEnterpriseAVs: number[] = [];
        for (const otherEnterprise of enterprises) {
          const { data: otherOutlets } = await supabase
            .from('discharge_outlets')
            .select('id')
            .eq('user_id', otherEnterprise.user_id)
            .eq('status', 'approved');

          if (!otherOutlets || otherOutlets.length === 0) continue;

          const otherOutletIds = otherOutlets.map(o => o.id);
          const { data: otherMonitoringData } = await supabase
            .from('monitoring_data')
            .select('pollutant_type, value')
            .in('outlet_id', otherOutletIds)
            .gte('monitored_at', fromDate.toISOString())
            .lte('monitored_at', toDate.toISOString());

          if (!otherMonitoringData || otherMonitoringData.length === 0) continue;

          // 计算该企业的平均 AV
          const valueMap: Record<string, number[]> = {};
          otherMonitoringData.forEach(record => {
            if (!valueMap[record.pollutant_type]) valueMap[record.pollutant_type] = [];
            valueMap[record.pollutant_type].push(record.value);
          });

          let totalAV = 0;
          let count = 0;
          for (const pollutant of pollutantList) {
            const values = valueMap[pollutant.id];
            if (values && values.length > 0) {
              totalAV += values.reduce((a, b) => a + b, 0) / values.length;
              count++;
            }
          }

          if (count > 0) {
            allEnterpriseAVs.push(totalAV / count);
          }
        }

        // 计算权重和 CDC
        let totalWeightedCDC = 0;
        let pollutantCount = 0;

        const m = enterprises.length; // 园区内企业数量

        for (const pollutant of pollutantList) {
          const stats = pollutantStats[pollutant.id];
          if (!stats) continue;

          // 计算权重：DML(Mi) = m × Wi / ΣWi
          const Wi = stats.av; // 当前企业的 AV 值
          const sumWi = allEnterpriseAVs.reduce((a, b) => a + b, 0);
          const weight = sumWi > 0 ? (m * Wi) / sumWi : 1;

          // 归一化（使用全局统计值）
          const allADs = Object.values(pollutantStats).map(s => s.ad);
          const allCVs = Object.values(pollutantStats).map(s => s.cv);
          const allSkews = Object.values(pollutantStats).map(s => Math.abs(s.skew));

          const maxAD = Math.max(...allADs) || 1;
          const maxCV = Math.max(...allCVs) || 1;
          const maxSkew = Math.max(...allSkews) || 1;

          const norAD = Math.min(stats.ad / maxAD, 1);
          const norCV = Math.min(stats.cv / maxCV, 1);
          const norSkew = Math.min(Math.abs(stats.skew) / maxSkew, 1);

          // CDC = [m × Wi / ΣWi] × [Nor(AD)² + Nor(CV)² + Nor(SKEW)²]
          const cdc = weight * (Math.pow(norAD, 2) + Math.pow(norCV, 2) + Math.pow(norSkew, 2));
          totalWeightedCDC += cdc;
          pollutantCount++;
        }

        const avgCDC = pollutantCount > 0 ? totalWeightedCDC / pollutantCount : 0;
        const riskInfo = getRiskLevel(avgCDC);

        ranking.push({
          enterpriseId: enterprise.id,
          enterpriseName: enterprise.company_name || enterprise.username || '未知企业',
          industry: enterprise.industry || '-',
          contactPerson: enterprise.contact_person || '-',
          totalOutlets: outlets.length,
          totalPollutants: pollutantList.length,
          overallCDC: parseFloat(avgCDC.toFixed(4)),
          riskLevel: riskInfo.level,
          riskColor: riskInfo.color
        });

      } catch (error) {
        console.error(`计算企业 ${enterprise.id} CDC 失败:`, error);
        ranking.push({
          enterpriseId: enterprise.id,
          enterpriseName: enterprise.company_name || enterprise.username || '未知企业',
          industry: enterprise.industry || '-',
          contactPerson: enterprise.contact_person || '-',
          totalOutlets: 0,
          totalPollutants: 0,
          overallCDC: 0,
          riskLevel: '低风险',
          riskColor: 'green'
        });
      }
    }

    // 按 CDC 值降序排列
    ranking.sort((a, b) => b.overallCDC - a.overallCDC);

    return NextResponse.json({
      success: true,
      data: ranking,
      parkName,
      period: {
        startDate: fromDate.toISOString(),
        endDate: toDate.toISOString()
      }
    });

  } catch (error) {
    console.error('CDC 排行 API 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
