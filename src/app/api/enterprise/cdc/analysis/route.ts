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

// 归一化
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  const result = (value - min) / (max - min);
  return Math.max(0, Math.min(1, result)); // 限制在 0-1 之间
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

    // 计算每个污染物的 CDC
    const pollutantCDCs: any[] = [];
    let totalWeightedCDC = 0;
    let totalWeight = 0;

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
          .select('value, monitored_at')
          .in('outlet_id', compOutletIds)
          .gte('monitored_at', fromDate.toISOString())
          .lte('monitored_at', toDate.toISOString());

        if (compMonitoringData && compMonitoringData.length > 0) {
          // 计算每日累计值
          const dailyValues: Record<string, number> = {};
          compMonitoringData.forEach(record => {
            const date = new Date(record.monitored_at).toISOString().split('T')[0];
            if (!dailyValues[date]) dailyValues[date] = 0;
            dailyValues[date] += record.value;
          });

          const values = Object.values(dailyValues);
          if (values.length > 0) {
            companyAVMap[compId] = values.reduce((a, b) => a + b, 0) / values.length;
          }
        }
      }
    }

    // 计算权重 DML(Mi) = m × Wi / ΣWi
    const sumWi = Object.values(companyAVMap).reduce((a, b) => a + b, 0);
    const weight = sumWi > 0 ? (m * (companyAVMap[companyId] || 0)) / sumWi : 1;

    // 计算所有污染物的历史统计值（用于归一化）
    const allPollutantValues = monitoringData.map(r => r.value);
    const globalAV = allPollutantValues.reduce((a, b) => a + b, 0) / allPollutantValues.length;
    const globalAD = allPollutantValues.reduce((a, b) => a + Math.abs(b - globalAV), 0) / allPollutantValues.length;
    const globalSD = calculateSD(allPollutantValues, globalAV);
    const globalCV = globalAV !== 0 ? globalSD / globalAV : 0;
    const globalSkew = calculateSkew(allPollutantValues, globalAV, globalSD);

    // 计算每个污染物的 CDC
    for (const pollutant of pollutantList) {
      const values = pollutantDataMap[pollutant.id];
      if (!values || values.length === 0) continue;

      const n = values.length;
      const av = values.reduce((a, b) => a + b, 0) / n;
      const ad = values.reduce((a, b) => a + Math.abs(b - av), 0) / n;
      const sd = calculateSD(values, av);
      const cv = av !== 0 ? sd / av : 0;
      const skew = calculateSkew(values, av, sd);

      // 归一化（使用全局统计值）
      const norAD = normalize(ad, 0, globalAD * 2 || 1);
      const norCV = normalize(cv, 0, globalCV * 2 || 1);
      const norSkew = normalize(skew, -1, 1);

      // 计算 CDC = [m × Wi / ΣWi] × [Nor(AD)² + Nor(CV)² + Nor(SKEW)²]
      const cdc = weight * (Math.pow(norAD, 2) + Math.pow(norCV, 2) + Math.pow(norSkew, 2));
      const riskInfo = getRiskLevel(cdc);

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
        riskColor: riskInfo.color
      });

      totalWeightedCDC += cdc;
      totalWeight += weight;
    }

    // 计算综合 CDC
    const overallCDC = totalWeight > 0 ? totalWeightedCDC / totalWeight : 0;
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

        const norAD = normalize(ad, 0, globalAD * 2 || 1);
        const norCV = normalize(cv, 0, globalCV * 2 || 1);
        const norSkew = normalize(skew, -1, 1);

        const cdc = weight * (Math.pow(norAD, 2) + Math.pow(norCV, 2) + Math.pow(norSkew, 2));

        lastTotalWeightedCDC += cdc;
        lastTotalWeight += weight;
      }

      lastPeriodCDC = lastTotalWeight > 0 ? lastTotalWeightedCDC / lastTotalWeight : 0;
    }

    const changeFromLastPeriod = overallCDC - lastPeriodCDC;

    // 计算归一化指标
    const currentAV = monitoringData.reduce((a, b) => a + b.value, 0) / monitoringData.length;
    const currentAD = monitoringData.reduce((a, b) => a + Math.abs(b.value - currentAV), 0) / monitoringData.length;
    const currentSD = calculateSD(monitoringData.map(m => m.value), currentAV);
    const currentCV = currentAV !== 0 ? currentSD / currentAV : 0;
    const currentSkew = calculateSkew(monitoringData.map(m => m.value), currentAV, currentSD);

    const norAV = normalize(currentAV, 0, globalAV * 2 || 1);
    const norAD = normalize(currentAD, 0, globalAD * 2 || 1);
    const norCV = normalize(currentCV, 0, globalCV * 2 || 1);
    const norSkew = normalize(currentSkew, -1, 1);

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
