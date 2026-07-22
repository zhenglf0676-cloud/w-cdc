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

    // 获取企业的已审批污染物（合并所有 approved 申请）
    const { data: applications } = await supabase
      .from('pollutant_applications')
      .select('pollutants')
      .eq('company_id', companyId)
      .eq('status', 'approved');

    let pollutantList: Array<{ id: string; label: string; threshold: number; unit: string }> = [];
    const pollutantMap: Record<string, { label: string; threshold: number; unit: string }> = {};
    if (applications && applications.length > 0) {
      try {
        // 合并所有申请的污染物
        for (const app of applications) {
          if (!app.pollutants) continue;
          const pollutants = typeof app.pollutants === 'string'
            ? JSON.parse(app.pollutants)
            : app.pollutants;
          pollutants.forEach((p: { id: string; label: string; threshold: number; unit: string }) => {
            // 避免重复
            if (!pollutantMap[p.id]) {
              pollutantMap[p.id] = { label: p.label, threshold: p.threshold, unit: p.unit };
              pollutantList.push(p);
            }
          });
        }
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
    const globalPollutantAVMap: Record<string, number> = {}; // 所有企业每个污染物的 AV 累加

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
        .eq('status', 'approved');

      let entPollutantList: Array<{ id: string }> = [];
      if (entApplications && entApplications.length > 0) {
        for (const app of entApplications) {
          if (app.pollutants) {
            try {
              const pollutants = typeof app.pollutants === 'string'
                ? JSON.parse(app.pollutants)
                : app.pollutants;
              entPollutantList = [...entPollutantList, ...pollutants];
            } catch (e) {}
          }
        }
        // 去重
        const seen = new Set<string>();
        entPollutantList = entPollutantList.filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
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

      const entSortedDates = Object.keys(entDailyPollutantData).sort();
      const pollutantAVMap: Record<string, number> = {};

      for (const pollutant of entPollutantList) {
        const dailyValues: number[] = [];
        for (const date of entSortedDates) {
          const outletValues = entDailyPollutantData[date][pollutant.id] || {};
          const total = Object.values(outletValues).reduce((sum, val) => sum + val, 0);
          if (total > 0) {
            dailyValues.push(total);
          }
        }
        if (dailyValues.length > 0) {
          const av = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
          pollutantAVMap[pollutant.id] = av;
          // 累加到全局 pollutantAVMap
          globalPollutantAVMap[pollutant.id] = (globalPollutantAVMap[pollutant.id] || 0) + av;
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
      const pollutantStats: Record<string, { av: number; ad: number; cv: number; skew: number; norAD?: number; norCV?: number; norSKEW?: number; cdc?: number; weight?: number }> = {};
      for (const pollutant of entPollutantList) {
        const dailyValues: number[] = [];
        for (const date of entSortedDates) {
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
    const pollutantStats: Record<string, { av: number; ad: number; cv: number; skew: number; norAD: number; norCV: number; norSKEW: number; cdc: number; weight?: number }> = {};

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

    // 计算权重（每个污染物单独计算）
    // Wi = (m × AV_i) / ΣAV，其中 ΣAV 是所有企业所有污染物的 AV 总和
    // 注意：allEnterpriseAVs 存储的是每个企业的综合 AV，不能直接用于 sumWi
    // 需要使用 globalPollutantAVMap（所有企业每个污染物的 AV 累加）来计算 ΣAV
    const sumWi = Object.values(globalPollutantAVMap).reduce((a: number, b: number) => a + b, 0);

    // 计算每个污染物的 CDC（使用 7 天数据，按 Word 文档）
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

      // 计算每个污染物的单独权重
      const pollutantWeight = sumWi > 0 ? (m * av) / sumWi : 1;
      const cdc = pollutantWeight * (Math.pow(norAD, 2) + Math.pow(norCV, 2) + Math.pow(norSKEW, 2));
      totalWeightedCDC += cdc;
      pollutantCount++;

      pollutantStats[pollutant.id] = { av, ad, cv, skew, norAD, norCV, norSKEW, cdc, weight: pollutantWeight };
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
    // 每个日期点的 CDC = 以该天为结束日期的 7 天窗口计算的 CDC
    const dailyPollutantCDC: Record<string, Record<string, number>> = {};

    for (const endDate of sortedDates) {
      // 计算 7 天窗口的起始日期
      const endDateTime = new Date(endDate).getTime();
      const startDateTime = endDateTime - 6 * 24 * 60 * 60 * 1000; // 7 天窗口（包含结束日期）
      const startDateStr = new Date(startDateTime).toISOString().split('T')[0];

      // 收集 7 天窗口的数据
      const windowDailyValues: Record<string, number[]> = {};
      for (const pollutant of pollutantList) {
        windowDailyValues[pollutant.id] = [];
      }

      for (const date of sortedDates) {
        if (date < startDateStr || date > endDate) continue;
        const dayPollutantData = dailyPollutantData[date];

        for (const pollutant of pollutantList) {
          const outletValues = dayPollutantData[pollutant.id];
          if (!outletValues || Object.keys(outletValues).length === 0) continue;
          const total = Object.values(outletValues).reduce((sum, val) => sum + val, 0);
          if (total > 0) {
            windowDailyValues[pollutant.id].push(total);
          }
        }
      }

      const dayCDC: Record<string, number> = {};

      for (const pollutant of pollutantList) {
        const values = windowDailyValues[pollutant.id];
        if (values.length === 0) continue;

        const n = values.length;
        const av = values.reduce((a, b) => a + b, 0) / n;
        const ad = values.reduce((a, b) => a + Math.abs(b - av), 0) / n;
        const squaredDiffs = values.map(v => Math.pow(v - av, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / n;
        const sd = Math.sqrt(avgSquaredDiff);
        const cv = av !== 0 ? sd / av : 0;
        const skew = sd !== 0 ? (values.reduce((a, b) => a + Math.pow(b - av, 3), 0) / n) / Math.pow(sd, 3) : 0;

        const norAD = globalMaxAD > 0 ? Math.min(ad / globalMaxAD, 1) : 0;
        const norCV = globalMaxCV > 0 ? Math.min(cv / globalMaxCV, 1) : 0;
        const norSKEW = globalMaxSKEW > 0 ? Math.min(Math.abs(skew) / globalMaxSKEW, 1) : 0;

        // 使用每个污染物的单独权重
        const pollutantWeight = sumWi > 0 ? (m * av) / sumWi : 1;
        const cdc = pollutantWeight * (Math.pow(norAD, 2) + Math.pow(norCV, 2) + Math.pow(norSKEW, 2));

        dayCDC[pollutant.id] = Math.round(cdc * 100) / 100;
      }

      dailyPollutantCDC[endDate] = dayCDC;
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
