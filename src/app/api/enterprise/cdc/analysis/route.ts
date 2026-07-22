import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 企业端 CDC 分析 API
 * 根据 Word 文档标准计算 CDC 值（与 Admin Ranking API 完全一致）
 */
export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();

    // 验证用户权限
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
      .select('id, role, company_name, park_name')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'enterprise') {
      return NextResponse.json({ error: '需要企业用户权限' }, { status: 403 });
    }

    const companyId = profile.id;
    const parkName = profile.park_name;

    // 获取日期范围（默认 7 天）
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let fromDate: Date, toDate: Date;
    if (startDate && endDate) {
      fromDate = new Date(startDate);
      toDate = new Date(endDate);
    } else {
      toDate = new Date();
      fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 设置 UTC 时间范围（中国时间 UTC+8）
    fromDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCHours(23, 59, 59, 999);

    // 获取企业的已审批排污口
    const { data: outlets, error: outletsError } = await supabase
      .from('discharge_outlets')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('status', 'approved');

    if (outletsError) {
      console.error('获取排污口失败:', outletsError);
      return NextResponse.json({ error: '获取排污口失败' }, { status: 500 });
    }

    if (!outlets || outlets.length === 0) {
      console.warn('企业没有已审批的排污口:', companyId);
      return NextResponse.json({ error: '没有已审批的排污口' }, { status: 400 });
    }

    // 获取企业的已审批污染物
    const { data: applications } = await supabase
      .from('pollutant_applications')
      .select('pollutants')
      .eq('company_id', companyId)
      .eq('status', 'approved')
      .limit(1);

    let pollutantList: Array<{ id: string; label: string; threshold: number; unit: string }> = [];
    const pollutantMap: Record<string, { label: string; threshold: number; unit: string }> = {};
    if (applications && applications.length > 0 && applications[0].pollutants) {
      try {
        const pollutants = typeof applications[0].pollutants === 'string'
          ? JSON.parse(applications[0].pollutants)
          : applications[0].pollutants;
        pollutantList = pollutants;
        // 创建污染物映射
        pollutants.forEach((p: { id: string; label: string; threshold: number; unit: string }) => {
          pollutantMap[p.id] = { label: p.label, threshold: p.threshold, unit: p.unit };
        });
      } catch (e) {
        console.error('解析污染物失败:', e);
      }
    }

    if (pollutantList.length === 0) {
      console.warn('企业没有已审批的污染物:', companyId);
      return NextResponse.json({ error: '没有已审批的污染物' }, { status: 400 });
    }

    // 获取监测数据
    const outletIds = outlets.map(o => o.id);
    const { data: monitoringData, error: monitoringError } = await supabase
      .from('monitoring_data')
      .select('outlet_id, pollutant_type, value, monitored_at')
      .in('outlet_id', outletIds)
      .gte('monitored_at', fromDate.toISOString())
      .lte('monitored_at', toDate.toISOString());

    if (monitoringError) {
      console.error('获取监测数据失败:', monitoringError);
      return NextResponse.json({ error: '获取监测数据失败' }, { status: 500 });
    }

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

    // 获取园区内所有企业（用于计算权重）
    const { data: allEnterprises } = await supabase
      .from('profiles')
      .select('id, user_id')
      .eq('role', 'enterprise')
      .eq('park_name', parkName);

    const m = allEnterprises?.length || 1;

    // 计算所有企业的 AV（用于归一化和权重）
    const allEnterpriseAVs: number[] = [];
    const allEnterpriseStats: Record<string, Record<string, { av: number; ad: number; cv: number; skew: number }>> = {};

    for (const enterprise of allEnterprises || []) {
      const { data: entOutlets } = await supabase
        .from('discharge_outlets')
        .select('id')
        .eq('user_id', enterprise.user_id)
        .eq('status', 'approved');

      if (!entOutlets || entOutlets.length === 0) continue;

      const { data: entApplications } = await supabase
        .from('pollutant_applications')
        .select('pollutants')
        .eq('company_id', enterprise.id)
        .eq('status', 'approved')
        .limit(1);

      let entPollutantList: Array<{ id: string }> = [];
      if (entApplications && entApplications.length > 0 && entApplications[0].pollutants) {
        try {
          const pollutants = typeof entApplications[0].pollutants === 'string'
            ? JSON.parse(entApplications[0].pollutants)
            : entApplications[0].pollutants;
          entPollutantList = pollutants;
        } catch (e) {}
      }

      if (entPollutantList.length === 0) continue;

      const entOutletIds = entOutlets.map(o => o.id);
      const { data: entMonitoringData } = await supabase
        .from('monitoring_data')
        .select('outlet_id, pollutant_type, value, monitored_at')
        .in('outlet_id', entOutletIds)
        .gte('monitored_at', fromDate.toISOString())
        .lte('monitored_at', toDate.toISOString());

      if (!entMonitoringData || entMonitoringData.length === 0) continue;

      const entDailyPollutantData: Record<string, Record<string, Record<string, number>>> = {};
      const entOutletMap: Record<string, boolean> = {};
      entOutlets.forEach(o => { entOutletMap[o.id] = true; });

      for (const record of entMonitoringData) {
        if (!entOutletMap[record.outlet_id]) continue;
        const date = new Date(new Date(record.monitored_at).getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
        const pollutantType = record.pollutant_type;

        if (!entDailyPollutantData[date]) entDailyPollutantData[date] = {};
        if (!entDailyPollutantData[date][pollutantType]) entDailyPollutantData[date][pollutantType] = {};

        const currentValue = entDailyPollutantData[date][pollutantType][record.outlet_id] || 0;
        if (record.value > currentValue) {
          entDailyPollutantData[date][pollutantType][record.outlet_id] = record.value;
        }
      }

      const sortedDates = Object.keys(entDailyPollutantData).sort();
      const pollutantAVMap: Record<string, number> = {};

      for (const pollutant of entPollutantList) {
        const dailyValues: number[] = [];
        for (const date of sortedDates) {
          const outletValues = entDailyPollutantData[date][pollutant.id] || {};
          const total = Object.values(outletValues).reduce((sum, val) => sum + val, 0);
          if (total > 0) {
            dailyValues.push(total);
          }
        }
        if (dailyValues.length > 0) {
          const av = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
          pollutantAVMap[pollutant.id] = av;
        }
      }

      const pollutantAVValues = Object.values(pollutantAVMap);
      const enterpriseAV = pollutantAVValues.length > 0
        ? pollutantAVValues.reduce((a, b) => a + b, 0) / pollutantAVValues.length
        : 0;

      if (enterpriseAV > 0) {
        allEnterpriseAVs.push(enterpriseAV);
      }

      // 计算每个污染物的统计指标
      const pollutantStats: Record<string, { av: number; ad: number; cv: number; skew: number }> = {};
      for (const pollutant of entPollutantList) {
        const dailyValues: number[] = [];
        for (const date of sortedDates) {
          const outletValues = entDailyPollutantData[date][pollutant.id] || {};
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

        pollutantStats[pollutant.id] = { av, ad, cv, skew };
      }

      allEnterpriseStats[enterprise.id] = pollutantStats;
    }

    // 计算最大值（用于归一化）
    let globalMaxAD = 0, globalMaxCV = 0, globalMaxSKEW = 0;
    for (const stats of Object.values(allEnterpriseStats)) {
      for (const { ad, cv, skew } of Object.values(stats)) {
        if (ad > globalMaxAD) globalMaxAD = ad;
        if (cv > globalMaxCV) globalMaxCV = cv;
        if (Math.abs(skew) > globalMaxSKEW) globalMaxSKEW = Math.abs(skew);
      }
    }

    // 计算当前企业的 CDC
    const sortedDates = Object.keys(dailyPollutantData).sort();
    const pollutantAVMap: Record<string, number> = {};
    const pollutantStats: Record<string, { av: number; ad: number; cv: number; skew: number; norAD: number; norCV: number; norSKEW: number; cdc: number }> = {};

    // 计算每个污染物的 AV
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

    // 计算企业综合 AV
    const pollutantAVValues = Object.values(pollutantAVMap);
    const currentEnterpriseAV = pollutantAVValues.length > 0
      ? pollutantAVValues.reduce((a, b) => a + b, 0) / pollutantAVValues.length
      : 0;

    // 计算权重
    const sumWi = allEnterpriseAVs.reduce((a, b) => a + b, 0);
    const weight = sumWi > 0 ? (m * currentEnterpriseAV) / sumWi : 1;

    // 计算每个污染物的 CDC
    let totalWeightedCDC = 0;
    let pollutantCount = 0;

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

      const norAD = globalMaxAD > 0 ? ad / globalMaxAD : 0;
      const norCV = globalMaxCV > 0 ? cv / globalMaxCV : 0;
      const norSKEW = globalMaxSKEW > 0 ? Math.abs(skew) / globalMaxSKEW : 0;

      const cdc = weight * (Math.pow(norAD, 2) + Math.pow(norCV, 2) + Math.pow(norSKEW, 2));
      totalWeightedCDC += cdc;
      pollutantCount++;

      pollutantStats[pollutant.id] = { av, ad, cv, skew, norAD, norCV, norSKEW, cdc };
    }

    const overallCDC = pollutantCount > 0 ? totalWeightedCDC / pollutantCount : 0;

    let riskLevel = '低风险';
    let riskColor = 'green';
    if (overallCDC >= 1.5) {
      riskLevel = '高风险';
      riskColor = 'red';
    } else if (overallCDC >= 0.5) {
      riskLevel = '中风险';
      riskColor = 'orange';
    }

    // 计算每日 CDC（用于趋势图）
    const dailyPollutantCDC: Record<string, Record<string, number>> = {};
    const sortedDates = Object.keys(dailyPollutantData).sort();

    for (const date of sortedDates) {
      const dayPollutantData = dailyPollutantData[date];
      const dayCDC: Record<string, number> = {};

      for (const pollutant of pollutantList) {
        const values = dayPollutantData[pollutant.id];
        if (!values || values.length === 0) continue;

        const n = values.length;
        const av = values.reduce((a, b) => a + b, 0) / n;
        const ad = values.reduce((a, b) => a + Math.abs(b - av), 0) / n;
        const squaredDiffs = values.map(v => Math.pow(v - av, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / n;
        const sd = Math.sqrt(avgSquaredDiff);
        const cv = av !== 0 ? sd / av : 0;
        const skew = sd !== 0 ? (values.reduce((a, b) => a + Math.pow(b - av, 3), 0) / n) / Math.pow(sd, 3) : 0;

        const norAD = maxAD > 0 ? Math.min(ad / maxAD, 1) : 0;
        const norCV = maxCV > 0 ? Math.min(cv / maxCV, 1) : 0;
        const norSKEW = maxSKEW > 0 ? Math.min(Math.abs(skew) / maxSKEW, 1) : 0;

        const weight = sumWi > 0 ? (m * currentCompanyAV) / sumWi : 1;
        const cdc = weight * (Math.pow(norAD, 2) + Math.pow(norCV, 2) + Math.pow(norSKEW, 2));

        dayCDC[pollutant.id] = Math.round(cdc * 100) / 100;
      }

      dailyPollutantCDC[date] = dayCDC;
    }

    return NextResponse.json({
      success: true,
      data: {
        enterpriseId: companyId,
        enterpriseName: profile.company_name || '',
        parkName: profile.park_name || '',
        analysisPeriod: {
          days: 7,
          startDate: fromDate.toISOString().split('T')[0],
          endDate: toDate.toISOString().split('T')[0]
        },
        overallCDC: Math.round(overallCDC * 100) / 100,
        lastPeriodCDC: 0,
        changeFromLastPeriod: 0,
        riskLevel,
        riskColor,
        totalOutlets: outlets.length,
        totalPollutants: pollutantList.length,
        pollutants: Object.entries(pollutantStats).map(([id, stats]) => ({
          pollutantId: id,
          pollutantName: pollutantMap[id]?.label || id,
          ...stats
        })),
        dailyPollutantCDC
      }
    });
  } catch (error) {
    console.error('CDC 分析失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
