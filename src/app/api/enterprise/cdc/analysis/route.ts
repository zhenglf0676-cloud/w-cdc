import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient } from '@/storage/database/supabase-client';

// 使用 service role key 绕过 RLS
function getSupabaseAdmin() {
  const { url, anonKey } = getSupabaseCredentials();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(url, serviceRoleKey || anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// 标准差计算
function calculateSD(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

// 偏度计算
function calculateSkew(values: number[], avg: number, sd: number): number {
  if (sd === 0 || values.length < 3) return 0;
  const n = values.length;
  const cubedDiffs = values.map(v => Math.pow((v - avg) / sd, 3));
  const sum = cubedDiffs.reduce((a, b) => a + b, 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

// 归一化（使用 0-1 范围，基于指标的理论范围）
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5; // 如果范围无效，返回中间值
  const result = (value - min) / (max - min);
  return Math.max(0, Math.min(1, result)); // 限制在 0-1 之间
}

// 计算归一化范围（基于数据分布）
function calculateNormalizationRange(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  // 使用 5% 和 95% 分位数作为范围，避免极端值影响
  const p5Index = Math.floor(sorted.length * 0.05);
  const p95Index = Math.floor(sorted.length * 0.95);
  return {
    min: sorted[p5Index] || min,
    max: sorted[p95Index] || max
  };
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

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 获取企业信息
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: '用户信息获取失败' }, { status: 400 });
    }

    const companyId = profile.id;
    const parkName = profile.park_name || '未知园区';
    const enterpriseName = profile.username || profile.email || '未知企业';

    // 获取企业已审批的排污口
    const { data: outlets, error: outletsError } = await supabase
      .from('discharge_outlets')
      .select('id, name')
      .eq('user_id', userId)
      .eq('status', 'approved');

    if (outletsError || !outlets || outlets.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: {
          enterpriseId: companyId,
          enterpriseName,
          parkName,
          analysisPeriod: { days: 0, startDate: '', endDate: '' },
          totalOutlets: 0,
          totalPollutants: 0,
          overallCDC: 0,
          riskLevel: '低风险',
          riskColor: 'green',
          pollutants: [],
          indicators: {
            av: { current: 0, normalized: 0 },
            ad: { current: 0, normalized: 0 },
            cv: { current: 0, normalized: 0 },
            skew: { current: 0, normalized: 0 }
          }
        }
      });
    }

    const outletIds = outlets.map(o => o.id);

    // 获取企业已审批的污染物
    const { data: pollutants, error: pollutantsError } = await supabase
      .from('pollutant_applications')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'approved');

    if (pollutantsError || !pollutants || pollutants.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: {
          enterpriseId: companyId,
          enterpriseName,
          parkName,
          analysisPeriod: { days: 0, startDate: '', endDate: '' },
          totalOutlets: outlets.length,
          totalPollutants: 0,
          overallCDC: 0,
          riskLevel: '低风险',
          riskColor: 'green',
          pollutants: [],
          indicators: {
            av: { current: 0, normalized: 0 },
            ad: { current: 0, normalized: 0 },
            cv: { current: 0, normalized: 0 },
            skew: { current: 0, normalized: 0 }
          }
        }
      });
    }

    // 解析污染物列表
    const pollutantList: { id: string; name: string; unit: string; threshold: number }[] = [];
    pollutants.forEach(app => {
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

    // 计算时间范围
    let fromDate: Date;
    let toDate: Date;
    let days = 7;

    if (startDate && endDate) {
      fromDate = new Date(startDate);
      toDate = new Date(endDate);
      days = Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
    } else {
      toDate = new Date();
      fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // 设置 UTC 时间范围（与 Admin Ranking API 一致）
    fromDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCHours(23, 59, 59, 999);

    // 获取监测数据
    const { data: monitoringData, error: dataError } = await supabase
      .from('monitoring_data')
      .select('*')
      .in('outlet_id', outletIds)
      .gte('monitored_at', fromDate.toISOString())
      .lte('monitored_at', toDate.toISOString())
      .order('monitored_at', { ascending: true });

    if (dataError) {
      console.error('获取监测数据失败:', dataError);
      return NextResponse.json({ error: '数据获取失败' }, { status: 500 });
    }

    // 如果没有监测数据，返回空结果
    if (!monitoringData || monitoringData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          enterpriseId: companyId,
          enterpriseName,
          parkName,
          analysisPeriod: { days, startDate: fromDate.toISOString(), endDate: toDate.toISOString() },
          totalOutlets: outlets.length,
          totalPollutants: pollutantList.length,
          overallCDC: 0,
          riskLevel: '低风险',
          riskColor: 'green',
          pollutants: [],
          indicators: {
            av: { current: 0, normalized: 0 },
            ad: { current: 0, normalized: 0 },
            cv: { current: 0, normalized: 0 },
            skew: { current: 0, normalized: 0 }
          }
        }
      });
    }

    // 按日期和污染物分组，每天取每个排污口的最新值，然后累加（根据 Word 文档标准）
    const dailyPollutantData: Record<string, Record<string, Record<string, number>>> = {};
    // 结构：{ date: { pollutantId: { outletId: latestValue } } }

    monitoringData.forEach(record => {
      const date = new Date(record.monitored_at).toISOString().split('T')[0];
      const pollutantType = record.pollutant_type;
      const outletId = record.outlet_id;
      const value = record.value;

      if (!dailyPollutantData[date]) {
        dailyPollutantData[date] = {};
      }
      if (!dailyPollutantData[date][pollutantType]) {
        dailyPollutantData[date][pollutantType] = {};
      }
      // 保留最新值（因为数据已按时间排序，后面的会覆盖前面的）
      dailyPollutantData[date][pollutantType][outletId] = value;
    });

    // 计算每天的累计值（所有排污口最新值之和）
    const pollutantDailyTotals: Record<string, number[]> = {};
    pollutantList.forEach(p => {
      pollutantDailyTotals[p.id] = [];
    });

    const sortedDates = Object.keys(dailyPollutantData).sort();
    for (const date of sortedDates) {
      for (const pollutant of pollutantList) {
        const outletValues = dailyPollutantData[date][pollutant.id] || {};
        const dailyTotal = Object.values(outletValues).reduce((sum, val) => sum + val, 0);
        if (dailyTotal > 0) {
          pollutantDailyTotals[pollutant.id].push(dailyTotal);
        }
      }
    }

    // 计算每个污染物的基础统计指标（使用每天累计值）
    const pollutantStats: Record<string, { av: number; ad: number; cv: number; skew: number }> = {};
    
    for (const pollutant of pollutantList) {
      const values = pollutantDailyTotals[pollutant.id];
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

    // 计算每个污染物的 CDC
    const pollutantCDCs: any[] = [];
    let totalWeightedCDC = 0;
    let pollutantCount = 0;

    // 按日期分组监测数据（使用中国时间 UTC+8）
    const dailyMonitoringData: Record<string, any[]> = {};
    monitoringData.forEach(record => {
      // 转换为 UTC+8 时间获取日期
      const date = new Date(new Date(record.monitored_at).getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (!dailyMonitoringData[date]) {
        dailyMonitoringData[date] = [];
      }
      dailyMonitoringData[date].push(record);
    });

    // 获取所有日期并排序
    const allDates = Object.keys(dailyMonitoringData).sort();

    // 获取园区内所有企业的数据（用于计算权重）
    const { data: allParkOutlets } = await supabase
      .from('discharge_outlets')
      .select('id, user_id')
      .eq('park_name', parkName)
      .eq('status', 'approved');

    const allCompanyIds = [...new Set(allParkOutlets?.map(o => o.user_id) || [])];
    const m = allCompanyIds.length;

    // 计算每个企业的 AV 值（用于权重计算）
    const companyAVMap: Record<string, number> = {};

    for (const compId of allCompanyIds) {
      const { data: compOutlets } = await supabase
        .from('discharge_outlets')
        .select('id')
        .eq('user_id', compId)
        .eq('status', 'approved');

      if (compOutlets && compOutlets.length > 0) {
        const compOutletIds = compOutlets.map(o => o.id);
        const { data: compMonitoringData } = await supabase
          .from('monitoring_data')
          .select('pollutant_type, value, monitored_at, outlet_id')
          .in('outlet_id', compOutletIds)
          .gte('monitored_at', fromDate.toISOString())
          .lte('monitored_at', toDate.toISOString());

        if (compMonitoringData && compMonitoringData.length > 0) {
          // 按日期和污染物分组，每天取每个排污口的最新值，然后累加（与 Admin Ranking API 一致）
          const dailyPollutantData: Record<string, Record<string, Record<string, number>>> = {};
          compMonitoringData.forEach(record => {
            const date = new Date(new Date(record.monitored_at).getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
            const pollutantType = record.pollutant_type;
            const outletId = record.outlet_id;
            const value = record.value;

            if (!dailyPollutantData[date]) {
              dailyPollutantData[date] = {};
            }
            if (!dailyPollutantData[date][pollutantType]) {
              dailyPollutantData[date][pollutantType] = {};
            }
            dailyPollutantData[date][pollutantType][outletId] = value;
          });

          // 计算该企业 7 天的平均累计值（只统计 pollutantList 中的污染物）
          const sortedDates = Object.keys(dailyPollutantData).sort();
          const dailyTotals: number[] = [];
          
          for (const date of sortedDates) {
            let dayTotal = 0;
            let pollutantCount = 0;
            for (const pollutant of pollutantList) {
              const outletValues = dailyPollutantData[date][pollutant.id] || {};
              const total = Object.values(outletValues).reduce((sum, val) => sum + val, 0);
              if (total > 0) {
                dayTotal += total;
                pollutantCount++;
              }
            }
            if (pollutantCount > 0) {
              dailyTotals.push(dayTotal);
            }
          }

          if (dailyTotals.length > 0) {
            companyAVMap[compId] = dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length;
          }
        }
      }
    }

    // 计算权重 DML(Mi) = m × Wi / ΣWi
    const sumWi = Object.values(companyAVMap).reduce((a, b) => a + b, 0);
    // 如果当前企业没有数据，使用园区平均值
    const currentCompanyAV = companyAVMap[companyId] || (sumWi / (m || 1));
    const weight = sumWi > 0 ? (m * currentCompanyAV) / sumWi : 1;

    // 计算所有污染物的历史统计值（用于归一化）
    const allPollutantValues = monitoringData.map(r => r.value);
    const globalAV = allPollutantValues.reduce((a, b) => a + b, 0) / allPollutantValues.length;
    const globalAD = allPollutantValues.reduce((a, b) => a + Math.abs(b - globalAV), 0) / allPollutantValues.length;
    const globalSD = calculateSD(allPollutantValues, globalAV);
    const globalCV = globalAV !== 0 ? globalSD / globalAV : 0;
    const globalSkew = calculateSkew(allPollutantValues, globalAV, globalSD);

    // 计算所有污染物的指标值（用于最大值归一化，根据 Word 文档）
    const allADValues = Object.values(pollutantStats).map(s => s.ad);
    const allCVValues = Object.values(pollutantStats).map(s => s.cv);
    const allSkewValues = Object.values(pollutantStats).map(s => Math.abs(s.skew));

    // 使用最大值归一化（根据 Word 文档：Nor(x) = x / max(x)）
    const maxAD = Math.max(...allADValues) || 1;
    const maxCV = Math.max(...allCVValues) || 1;
    const maxSkew = Math.max(...allSkewValues) || 1;

    // 先计算每日各污染物的 CDC 值（用于趋势图和最后一天的 CDC）
    const dailyPollutantCDC: Record<string, Record<string, number>> = {};
    
    for (const date of allDates) {
      const dayData = dailyMonitoringData[date];
      if (!dayData || dayData.length === 0) continue;

      // 按污染物分组当天的数据
      const dayPollutantData: Record<string, number[]> = {};
      pollutantList.forEach(p => {
        dayPollutantData[p.id] = [];
      });

      dayData.forEach(record => {
        if (dayPollutantData[record.pollutant_type]) {
          dayPollutantData[record.pollutant_type].push(record.value);
        }
      });

      // 计算当天每个污染物的 CDC
      const dayCDCs: Record<string, number> = {};
      for (const pollutant of pollutantList) {
        const values = dayPollutantData[pollutant.id];
        if (!values || values.length === 0) continue;

        const n = values.length;
        const av = values.reduce((a, b) => a + b, 0) / n;
        const ad = values.reduce((a, b) => a + Math.abs(b - av), 0) / n;
        const sd = calculateSD(values, av);
        const cv = av !== 0 ? sd / av : 0;
        const skew = calculateSkew(values, av, sd);

        const norAD = Math.min(ad / maxAD, 1);
        const norCV = Math.min(cv / maxCV, 1);
        const norSkew = Math.min(Math.abs(skew) / maxSkew, 1);

        const cdc = weight * (Math.pow(norAD, 2) + Math.pow(norCV, 2) + Math.pow(norSkew, 2));
        dayCDCs[pollutant.id] = parseFloat(cdc.toFixed(4));
      }

      dailyPollutantCDC[date] = dayCDCs;
    }

    // 获取最后一天的日期和数据
    const lastDate = allDates[allDates.length - 1];
    const lastDayData = dailyMonitoringData[lastDate] || [];
    const lastDayPollutantData: Record<string, number[]> = {};
    pollutantList.forEach(p => {
      lastDayPollutantData[p.id] = [];
    });
    lastDayData.forEach(record => {
      if (lastDayPollutantData[record.pollutant_type]) {
        lastDayPollutantData[record.pollutant_type].push(record.value);
      }
    });

    // 计算每个污染物的 CDC（使用整个周期的数据）
    for (const pollutant of pollutantList) {
      const stats = pollutantStats[pollutant.id];
      if (!stats) continue;

      const { av, ad, cv, skew } = stats;

      // 归一化（使用最大值归一化，根据 Word 文档）
      const norAD = Math.min(ad / maxAD, 1);
      const norCV = Math.min(cv / maxCV, 1);
      const norSkew = Math.min(Math.abs(skew) / maxSkew, 1);

      // 计算 CDC = [m × Wi / ΣWi] × [Nor(AD)² + Nor(CV)² + Nor(SKEW)²]
      const cdc = weight * (Math.pow(norAD, 2) + Math.pow(norCV, 2) + Math.pow(norSkew, 2));
      const riskInfo = getRiskLevel(cdc);

      // 计算最后一天的指标（用于雷达图展示）
      const lastDayValues = lastDayPollutantData[pollutant.id];
      let lastDayAv = av, lastDayAd = ad, lastDayCv = cv, lastDaySkew = skew;
      let lastDayNorAv = 0, lastDayNorAd = norAD, lastDayNorCv = norCV, lastDayNorSkew = norSkew;
      
      if (lastDayValues && lastDayValues.length > 0) {
        const lastN = lastDayValues.length;
        lastDayAv = lastDayValues.reduce((a, b) => a + b, 0) / lastN;
        lastDayAd = lastDayValues.reduce((a, b) => a + Math.abs(b - lastDayAv), 0) / lastN;
        const lastDaySd = calculateSD(lastDayValues, lastDayAv);
        lastDayCv = lastDayAv !== 0 ? lastDaySd / lastDayAv : 0;
        lastDaySkew = calculateSkew(lastDayValues, lastDayAv, lastDaySd);
        
        lastDayNorAv = normalize(lastDayAv, 0, globalAV * 2 || 1);
        lastDayNorAd = Math.min(lastDayAd / maxAD, 1);
        lastDayNorCv = Math.min(lastDayCv / maxCV, 1);
        lastDayNorSkew = Math.min(Math.abs(lastDaySkew) / maxSkew, 1);
      }

      pollutantCDCs.push({
        pollutantId: pollutant.id,
        pollutantName: pollutant.name,
        av: parseFloat(av.toFixed(4)),
        ad: parseFloat(ad.toFixed(4)),
        cv: parseFloat(cv.toFixed(4)),
        skew: parseFloat(skew.toFixed(4)),
        cdc: parseFloat(cdc.toFixed(4)),
        weight: parseFloat(weight.toFixed(4)),
        riskLevel: riskInfo.level,
        riskColor: riskInfo.color,
        // 最后一天的指标（用于雷达图展示）
        lastDayAv: parseFloat(lastDayAv.toFixed(4)),
        lastDayAd: parseFloat(lastDayAd.toFixed(4)),
        lastDayCv: parseFloat(lastDayCv.toFixed(4)),
        lastDaySkew: parseFloat(lastDaySkew.toFixed(4)),
        lastDayNorAv: parseFloat(lastDayNorAv.toFixed(4)),
        lastDayNorAd: parseFloat(lastDayNorAd.toFixed(4)),
        lastDayNorCv: parseFloat(lastDayNorCv.toFixed(4)),
        lastDayNorSkew: parseFloat(lastDayNorSkew.toFixed(4)),
        lastDayCDC: parseFloat((dailyPollutantCDC[lastDate]?.[pollutant.id] || 0).toFixed(4))
      });

      totalWeightedCDC += cdc;
      pollutantCount++;
    }

    // 计算综合 CDC（使用污染物数量作为除数，与 Admin API 一致）
    const overallCDC = pollutantCount > 0 ? totalWeightedCDC / pollutantCount : 0;
    const overallRisk = getRiskLevel(overallCDC);

    // 计算上周 CDC（前一个周期的数据）
    const periodLength = toDate.getTime() - fromDate.getTime();
    const lastPeriodFrom = new Date(fromDate.getTime() - periodLength);
    const lastPeriodTo = new Date(fromDate.getTime() - 1); // 前一天

    // 获取上周期的监测数据
    const { data: lastPeriodData } = await supabase
      .from('monitoring_data')
      .select('*')
      .in('outlet_id', outletIds)
      .gte('monitored_at', lastPeriodFrom.toISOString())
      .lte('monitored_at', lastPeriodTo.toISOString());

    let lastPeriodCDC = 0;
    if (lastPeriodData && lastPeriodData.length > 0) {
      // 按污染物分组计算上周期 CDC
      const lastPollutantDataMap: Record<string, number[]> = {};
      pollutantList.forEach(p => {
        lastPollutantDataMap[p.id] = [];
      });

      lastPeriodData.forEach(record => {
        if (lastPollutantDataMap[record.pollutant_type]) {
          lastPollutantDataMap[record.pollutant_type].push(record.value);
        }
      });

      let lastTotalWeightedCDC = 0;
      let lastTotalWeight = 0;

      for (const pollutant of pollutantList) {
        const values = lastPollutantDataMap[pollutant.id];
        if (!values || values.length === 0) continue;

        const n = values.length;
        const av = values.reduce((a, b) => a + b, 0) / n;
        const ad = values.reduce((a, b) => a + Math.abs(b - av), 0) / n;
        const sd = calculateSD(values, av);
        const cv = av !== 0 ? sd / av : 0;
        const skew = calculateSkew(values, av, sd);

        // 使用相同的归一化范围
        const norAD = Math.min(ad / maxAD, 1);
        const norCV = Math.min(cv / maxCV, 1);
        const norSkew = Math.min(Math.abs(skew) / maxSkew, 1);

        const cdc = weight * (Math.pow(norAD, 2) + Math.pow(norCV, 2) + Math.pow(norSkew, 2));

        lastTotalWeightedCDC += cdc;
        lastTotalWeight += weight;
      }

      lastPeriodCDC = lastTotalWeight > 0 ? lastTotalWeightedCDC / lastTotalWeight : 0;
    }

    const changeFromLastPeriod = overallCDC - lastPeriodCDC;

    // 计算归一化指标（用于雷达图展示）
    // 使用企业所有污染物的综合指标
    const allValues = monitoringData.map(m => m.value);
    const currentAV = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const currentAD = allValues.reduce((a, b) => a + Math.abs(b - currentAV), 0) / allValues.length;
    const currentSD = calculateSD(allValues, currentAV);
    const currentCV = currentAV !== 0 ? currentSD / currentAV : 0;
    const currentSkew = calculateSkew(allValues, currentAV, currentSD);

    // 使用相同的归一化范围
    const norAV = normalize(currentAV, 0, globalAV * 2 || 1);
    const norAD = Math.min(currentAD / maxAD, 1);
    const norCV = Math.min(currentCV / maxCV, 1);
    const norSkew = Math.min(Math.abs(currentSkew) / maxSkew, 1);

    return NextResponse.json({
      success: true,
      data: {
        enterpriseId: companyId,
        enterpriseName,
        parkName,
        analysisPeriod: { 
          days, 
          startDate: fromDate.toISOString(), 
          endDate: toDate.toISOString() 
        },
        totalOutlets: outlets.length,
        totalPollutants: pollutantList.length,
        overallCDC: parseFloat(overallCDC.toFixed(4)),
        lastPeriodCDC: parseFloat(lastPeriodCDC.toFixed(4)),
        changeFromLastPeriod: parseFloat(changeFromLastPeriod.toFixed(4)),
        riskLevel: overallRisk.level,
        riskColor: overallRisk.color,
        pollutants: pollutantCDCs,
        dailyPollutantCDC: dailyPollutantCDC,
        indicators: {
          av: { 
            current: parseFloat(currentAV.toFixed(4)), 
            normalized: parseFloat(norAV.toFixed(4)) 
          },
          ad: { 
            current: parseFloat(currentAD.toFixed(4)), 
            normalized: parseFloat(norAD.toFixed(4)) 
          },
          cv: { 
            current: parseFloat(currentCV.toFixed(4)), 
            normalized: parseFloat(norCV.toFixed(4)) 
          },
          skew: { 
            current: parseFloat(currentSkew.toFixed(4)), 
            normalized: parseFloat(norSkew.toFixed(4)) 
          }
        }
      }
    });

  } catch (error) {
    console.error('CDC 分析 API 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
