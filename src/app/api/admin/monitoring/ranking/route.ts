import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * Admin CDC 风险排行 API
 * 根据 Word 文档标准计算 CDC 值
 */
export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();

    // 验证管理员权限
    const authHeader = request.headers.get('x-auth-token');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader);
    if (userError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, park_name')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const parkName = profile.park_name;
    if (!parkName) {
      return NextResponse.json({ error: '未设置园区名称' }, { status: 400 });
    }

    // 获取园区内所有企业
    const { data: enterprises, error: enterprisesError } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, company_name, park_name')
      .eq('role', 'enterprise')
      .eq('park_name', parkName);

    if (enterprisesError) {
      console.error('获取企业列表失败:', enterprisesError);
      return NextResponse.json({ error: '获取企业列表失败' }, { status: 500 });
    }

    if (!enterprises || enterprises.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const m = enterprises.length; // 园区内企业数量

    // 获取所有企业的已审批排污口
    const enterpriseOutletMap: Record<string, Array<{ id: string; name: string }>> = {};
    for (const enterprise of enterprises) {
      const { data: outlets } = await supabase
        .from('discharge_outlets')
        .select('id, name')
        .eq('user_id', enterprise.user_id)
        .eq('status', 'approved');

      if (outlets && outlets.length > 0) {
        enterpriseOutletMap[enterprise.id] = outlets;
      }
    }

    // 获取所有企业的已审批污染物
    const enterprisePollutantMap: Record<string, Array<{ id: string; label: string; threshold: number; unit: string }>> = {};
    for (const enterprise of enterprises) {
      const { data: applications } = await supabase
        .from('pollutant_applications')
        .select('pollutants')
        .eq('company_id', enterprise.id)
        .eq('status', 'approved')
        .limit(1);

      if (applications && applications.length > 0 && applications[0].pollutants) {
        try {
          const pollutants = typeof applications[0].pollutants === 'string'
            ? JSON.parse(applications[0].pollutants)
            : applications[0].pollutants;
          enterprisePollutantMap[enterprise.id] = pollutants;
        } catch (e) {
          console.error('解析污染物失败:', e);
        }
      }
    }

    // 获取 7 天的监测数据（中国时间 UTC+8）
    const now = new Date();
    const toDate = new Date(now);
    toDate.setUTCHours(23, 59, 59, 999);
    const fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    fromDate.setUTCHours(0, 0, 0, 0);

    // 获取所有相关排污口的监测数据
    const allOutletIds = Object.values(enterpriseOutletMap).flat().map(o => o.id);
    if (allOutletIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data: monitoringData, error: monitoringError } = await supabase
      .from('monitoring_data')
      .select('outlet_id, pollutant_type, value, monitored_at')
      .in('outlet_id', allOutletIds)
      .gte('monitored_at', fromDate.toISOString())
      .lte('monitored_at', toDate.toISOString());

    if (monitoringError) {
      console.error('获取监测数据失败:', monitoringError);
      return NextResponse.json({ error: '获取监测数据失败' }, { status: 500 });
    }

    // 按企业分组计算 CDC
    const enterpriseCDCMap: Record<string, { overallCDC: number; riskLevel: string; riskColor: string }> = {};

    for (const enterprise of enterprises) {
      const outlets = enterpriseOutletMap[enterprise.id] || [];
      const pollutantList = enterprisePollutantMap[enterprise.id] || [];

      if (outlets.length === 0 || pollutantList.length === 0) continue;

      // 按日期和污染物分组，每天取每个排污口的最新值，累加所有排污口
      const dailyPollutantData: Record<string, Record<string, Record<string, number>>> = {};
      const outletMap: Record<string, string> = {};
      outlets.forEach(o => { outletMap[o.id] = o.name; });

      for (const record of monitoringData || []) {
        if (!outletMap[record.outlet_id]) continue;

        // 使用中国时间（UTC+8）获取日期
        const date = new Date(new Date(record.monitored_at).getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
        const pollutantType = record.pollutant_type;

        if (!dailyPollutantData[date]) dailyPollutantData[date] = {};
        if (!dailyPollutantData[date][pollutantType]) dailyPollutantData[date][pollutantType] = {};

        const currentValue = dailyPollutantData[date][pollutantType][record.outlet_id] || 0;
        if (record.value > currentValue) {
          dailyPollutantData[date][pollutantType][record.outlet_id] = record.value;
        }
      }

      // 计算每个污染物的统计指标
      const sortedDates = Object.keys(dailyPollutantData).sort();
      let totalWeightedCDC = 0;
      const allEnterpriseAVs: number[] = [];

      // 先计算每个污染物的 AV，用于企业综合 AV
      const pollutantAVMap: Record<string, number> = {};
      for (const pollutant of pollutantList) {
        const dailyValues: number[] = [];
        for (const date of sortedDates) {
          const outletValues = dailyPollutantData[date][pollutant.id] || {};
          const total = Object.values(outletValues).reduce((sum, val) => sum + val, 0);
          if (total > 0) {
            dailyValues.push(total);
          }
        }
        if (dailyValues.length > 0) {
          pollutantAVMap[pollutant.id] = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
        }
      }

      // 计算企业综合 AV（所有污染物 AV 的平均）
      const pollutantAVValues = Object.values(pollutantAVMap);
      const currentEnterpriseAV = pollutantAVValues.length > 0
        ? pollutantAVValues.reduce((a, b) => a + b, 0) / pollutantAVValues.length
        : 0;
      allEnterpriseAVs.push(currentEnterpriseAV);

      // 计算每个污染物的 CDC
      for (const pollutant of pollutantList) {
        const dailyValues: number[] = [];
        for (const date of sortedDates) {
          const outletValues = dailyPollutantData[date][pollutant.id] || {};
          const total = Object.values(outletValues).reduce((sum, val) => sum + val, 0);
          if (total > 0) {
            dailyValues.push(total);
          }
        }

        if (dailyValues.length === 0) continue;

        const n = dailyValues.length;
        const av = dailyValues.reduce((a, b) => a + b, 0) / n;
        const ad = dailyValues.reduce((a, b) => a + Math.abs(b - av), 0) / n;
        const squaredDiffs = dailyValues.map(v => Math.pow(v - av, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / n;
        const sd = Math.sqrt(avgSquaredDiff);
        const cv = av !== 0 ? sd / av : 0;
        const skew = sd !== 0 ? (dailyValues.reduce((a, b) => a + Math.pow(b - av, 3), 0) / n) / Math.pow(sd, 3) : 0;

        // 存储归一化前的值，稍后统一归一化
        if (!enterpriseCDCMap[enterprise.id]) {
          enterpriseCDCMap[enterprise.id] = { overallCDC: 0, riskLevel: '低风险', riskColor: 'green' };
        }

        // 临时存储，稍后计算
        if (!(enterprise.id as any).__pollutantStats) (enterprise as any).__pollutantStats = {};
        (enterprise as any).__pollutantStats[pollutant.id] = { av, ad, cv, skew };
      }
    }

    // 计算所有企业的最大值，用于归一化
    const maxAD = Math.max(...Object.values(enterpriseCDCMap).map(() => 0)); // 占位
    const maxCV = Math.max(...Object.values(enterpriseCDCMap).map(() => 0)); // 占位
    const maxSKEW = Math.max(...Object.values(enterpriseCDCMap).map(() => 0)); // 占位

    // 重新计算最大值
    let globalMaxAD = 0, globalMaxCV = 0, globalMaxSKEW = 0;
    for (const enterprise of enterprises) {
      const stats = (enterprise as any).__pollutantStats;
      if (!stats) continue;
      for (const pollutantId of Object.keys(stats)) {
        const { ad, cv, skew } = stats[pollutantId];
        if (ad > globalMaxAD) globalMaxAD = ad;
        if (cv > globalMaxCV) globalMaxCV = cv;
        if (Math.abs(skew) > globalMaxSKEW) globalMaxSKEW = Math.abs(skew);
      }
    }

    // 计算每个企业的 CDC
    const sumWi = allEnterpriseAVs.reduce((a, b) => a + b, 0);
    const results = [];

    for (const enterprise of enterprises) {
      const stats = (enterprise as any).__pollutantStats;
      if (!stats) continue;

      const pollutantList = enterprisePollutantMap[enterprise.id] || [];
      const currentEnterpriseAV = Object.values(pollutantAVMap).length > 0
        ? Object.values(pollutantAVMap).reduce((a, b) => a + b, 0) / Object.values(pollutantAVMap).length
        : 0;

      const weight = sumWi > 0 ? (m * currentEnterpriseAV) / sumWi : 1;

      let totalCDC = 0;
      let pollutantCount = 0;

      for (const pollutant of pollutantList) {
        const { ad, cv, skew } = stats[pollutant.id] || {};
        if (ad === undefined) continue;

        const norAD = globalMaxAD > 0 ? ad / globalMaxAD : 0;
        const norCV = globalMaxCV > 0 ? cv / globalMaxCV : 0;
        const norSKEW = globalMaxSKEW > 0 ? Math.abs(skew) / globalMaxSKEW : 0;

        const cdc = weight * (Math.pow(norAD, 2) + Math.pow(norCV, 2) + Math.pow(norSKEW, 2));
        totalCDC += cdc;
        pollutantCount++;
      }

      const overallCDC = pollutantCount > 0 ? totalCDC / pollutantCount : 0;

      let riskLevel = '低风险';
      let riskColor = 'green';
      if (overallCDC >= 1.5) {
        riskLevel = '高风险';
        riskColor = 'red';
      } else if (overallCDC >= 0.5) {
        riskLevel = '中风险';
        riskColor = 'orange';
      }

      results.push({
        id: enterprise.id,
        name: enterprise.company_name || enterprise.full_name,
        overallCDC: Math.round(overallCDC * 100) / 100,
        riskLevel,
        riskColor
      });
    }

    // 按 CDC 值降序排序
    results.sort((a, b) => b.overallCDC - a.overallCDC);

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('CDC 排行计算失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
