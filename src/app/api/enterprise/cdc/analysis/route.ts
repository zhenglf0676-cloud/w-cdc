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
  const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

// 偏度计算
function calculateSkew(values: number[], avg: number, sd: number): number {
  if (sd === 0) return 0;
  const n = values.length;
  const cubedDiffs = values.map(v => Math.pow((v - avg) / sd, 3));
  const sum = cubedDiffs.reduce((a, b) => a + b, 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

// 归一化
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

// 计算单个污染物的 CDC
function calculatePollutantCDC(dailyValues: number[], historicalStats: {
  adMin: number; adMax: number;
  cvMin: number; cvMax: number;
  skewMin: number; skewMax: number;
}) {
  if (dailyValues.length === 0) return null;

  const n = dailyValues.length;
  
  // 计算基础统计指标
  const av = dailyValues.reduce((a, b) => a + b, 0) / n;
  const ad = dailyValues.reduce((a, b) => a + Math.abs(b - av), 0) / n;
  const sd = calculateSD(dailyValues, av);
  const cv = av !== 0 ? sd / av : 0;
  const skew = calculateSkew(dailyValues, av, sd);

  // 归一化
  const norAD = normalize(ad, historicalStats.adMin, historicalStats.adMax);
  const norCV = normalize(cv, historicalStats.cvMin, historicalStats.cvMax);
  const norSkew = normalize(skew, historicalStats.skewMin, historicalStats.skewMax);

  // 计算 CDC
  const cdc = Math.pow(norAD, 2) + Math.pow(norCV, 2) + Math.pow(norSkew, 2);

  return { av, ad, cv, skew, cdc };
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
    const days = parseInt(searchParams.get('days') || '7');
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

    // 使用 profile.id 作为 company_id
    const companyId = profile.id;
    const parkName = profile.park_name;

    // 获取企业已审批的排污口（使用 user_id）
    const { data: outlets, error: outletsError } = await supabase
      .from('discharge_outlets')
      .select('id, name')
      .eq('user_id', userId)
      .eq('status', 'approved');

    if (outletsError || !outlets || outlets.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: {
          currentCDC: 0,
          riskLevel: '低风险',
          cdcMax: 0,
          lastWeekCDC: 0,
          indicators: [],
          trendData: [],
          pollutants: [],
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
          currentCDC: 0,
          riskLevel: '低风险',
          cdcMax: 0,
          lastWeekCDC: 0,
          indicators: [],
          trendData: [],
          pollutants: [],
        }
      });
    }

    // 解析污染物列表（pollutants 字段是数组）
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

    if (startDate && endDate) {
      fromDate = new Date(startDate);
      toDate = new Date(endDate);
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

    // 按污染物类型分组
    const pollutantData: Record<string, any[]> = {};
    pollutantList.forEach(p => {
      pollutantData[p.id] = [];
    });

    monitoringData?.forEach(record => {
      if (pollutantData[record.pollutant_type]) {
        pollutantData[record.pollutant_type].push(record);
      }
    });

    // 计算每日企业监测值（所有排污口最新监测值的累计值）
    const dailyValues: Record<string, number> = {};

    monitoringData?.forEach(record => {
      const date = new Date(record.monitored_at).toISOString().split('T')[0];
      if (!dailyValues[date]) {
        dailyValues[date] = 0;
      }
      dailyValues[date] += record.value;
    });

    // 获取日期列表
    const dates = Object.keys(dailyValues).sort();

    // 计算基础统计指标（7 天数据）
    const recentDates = dates.slice(-7); // 最近 7 天
    const recentValues = recentDates.map(d => dailyValues[d]);

    if (recentValues.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          currentCDC: 0,
          riskLevel: '低风险',
          indicators: null,
          trend: []
        }
      });
    }

    const n = recentValues.length;
    const av = recentValues.reduce((a, b) => a + b, 0) / n;
    const ad = recentValues.reduce((a, b) => a + Math.abs(b - av), 0) / n;
    const sd = calculateSD(recentValues, av);
    const cv = av !== 0 ? sd / av : 0;
    const skew = calculateSkew(recentValues, av, sd);

    // 计算历史统计值（用于归一化）- 使用所有历史数据
    const allValues = dates.map(d => dailyValues[d]);
    const allAV = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const allAD = allValues.reduce((a, b) => a + Math.abs(b - allAV), 0) / allValues.length;
    const allSD = calculateSD(allValues, allAV);
    const allCV = allAV !== 0 ? allSD / allAV : 0;
    const allSkew = calculateSkew(allValues, allAV, allSD);

    // 归一化（使用历史数据的 min/max）
    const norAD = normalize(ad, 0, allAD * 2);
    const norCV = normalize(cv, 0, allCV * 2);
    const norSkew = normalize(skew, -1, 1);

    // 获取园区内所有企业的数据（用于计算权重）
    const { data: allOutlets, error: allOutletsError } = await supabase
      .from('discharge_outlets')
      .select('id, user_id')
      .eq('park_name', parkName)
      .eq('status', 'approved');

    if (allOutletsError) {
      console.error('获取园区排污口失败:', allOutletsError);
    }

    // 计算每个企业的 AV 值（用于权重计算）
    const companyAVMap: Record<string, number> = {};
    const allCompanyIds = [...new Set(allOutlets?.map(o => o.user_id) || [])];

    for (const companyId of allCompanyIds) {
      const { data: companyOutlets } = await supabase
        .from('discharge_outlets')
        .select('id')
        .eq('user_id', companyId)
        .eq('status', 'approved');

      if (companyOutlets && companyOutlets.length > 0) {
        const companyOutletIds = companyOutlets.map(o => o.id);
        const { data: companyMonitoringData } = await supabase
          .from('monitoring_data')
          .select('pollutant_type, value, monitored_at')
          .in('outlet_id', companyOutletIds)
          .gte('monitored_at', fromDate.toISOString())
          .lte('monitored_at', toDate.toISOString());

        if (companyMonitoringData && companyMonitoringData.length > 0) {
          // 计算每日累计值
          const companyDailyValues: Record<string, number> = {};
          companyMonitoringData.forEach(record => {
            const date = new Date(record.monitored_at).toISOString().split('T')[0];
            if (!companyDailyValues[date]) {
              companyDailyValues[date] = 0;
            }
            companyDailyValues[date] += record.value;
          });

          // 计算 AV
          const values = Object.values(companyDailyValues);
          if (values.length > 0) {
            companyAVMap[companyId] = values.reduce((a, b) => a + b, 0) / values.length;
          }
        }
      }
    }

    // 计算权重 DML(Mi) = m × Wi / ΣWi
    const m = allCompanyIds.length;
    const sumWi = Object.values(companyAVMap).reduce((a, b) => a + b, 0);
    const weight = sumWi > 0 ? (m * companyAVMap[companyId]) / sumWi : 1;

    // 计算 CDC 值
    // CDC = [m × Wi / ΣWi] × [Nor(AD)² + Nor(CV)² + Nor(SKEW)²]
    const currentCDC = weight * (norAD ** 2 + norCV ** 2 + norSkew ** 2);
    const riskLevel = getRiskLevel(currentCDC);

    // 计算上周 CDC（前 7 天的数据）
    const lastWeekDates = dates.slice(-14, -7);
    const lastWeekValues = lastWeekDates.map(d => dailyValues[d]);
    let lastWeekCDC = 0;

    if (lastWeekValues.length >= 3) {
      const lwN = lastWeekValues.length;
      const lwAV = lastWeekValues.reduce((a, b) => a + b, 0) / lwN;
      const lwAD = lastWeekValues.reduce((a, b) => a + Math.abs(b - lwAV), 0) / lwN;
      const lwSD = calculateSD(lastWeekValues, lwAV);
      const lwCV = lwAV !== 0 ? lwSD / lwAV : 0;
      const lwSkew = calculateSkew(lastWeekValues, lwAV, lwSD);

      const lwNorAD = normalize(lwAD, 0, allAD * 2);
      const lwNorCV = normalize(lwCV, 0, allCV * 2);
      const lwNorSkew = normalize(lwSkew, -1, 1);

      lastWeekCDC = weight * (lwNorAD ** 2 + lwNorCV ** 2 + lwNorSkew ** 2);
    }

    // 计算历史最大 CDC
    let maxCDC = currentCDC;
    for (let i = 7; i <= dates.length; i++) {
      const periodDates = dates.slice(Math.max(0, i - 7), i);
      const periodValues = periodDates.map(d => dailyValues[d]);

      if (periodValues.length >= 3) {
        const pN = periodValues.length;
        const pAV = periodValues.reduce((a, b) => a + b, 0) / pN;
        const pAD = periodValues.reduce((a, b) => a + Math.abs(b - pAV), 0) / pN;
        const pSD = calculateSD(periodValues, pAV);
        const pCV = pAV !== 0 ? pSD / pAV : 0;
        const pSkew = calculateSkew(periodValues, pAV, pSD);

        const pNorAD = normalize(pAD, 0, allAD * 2);
        const pNorCV = normalize(pCV, 0, allCV * 2);
        const pNorSkew = normalize(pSkew, -1, 1);

        const periodCDC = weight * (pNorAD ** 2 + pNorCV ** 2 + pNorSkew ** 2);
        if (periodCDC > maxCDC) {
          maxCDC = periodCDC;
        }
      }
    }

    // 计算 CDC 趋势（每天往前推 7 天）
    const trendData: Record<string, any>[] = [];
    for (let i = 7; i <= dates.length; i++) {
      const periodDates = dates.slice(Math.max(0, i - 7), i);
      const periodValues = periodDates.map(d => dailyValues[d]);

      if (periodValues.length >= 3) {
        const pN = periodValues.length;
        const pAV = periodValues.reduce((a, b) => a + b, 0) / pN;
        const pAD = periodValues.reduce((a, b) => a + Math.abs(b - pAV), 0) / pN;
        const pSD = calculateSD(periodValues, pAV);
        const pCV = pAV !== 0 ? pSD / pAV : 0;
        const pSkew = calculateSkew(periodValues, pAV, pSD);

        const pNorAD = normalize(pAD, 0, allAD * 2);
        const pNorCV = normalize(pCV, 0, allCV * 2);
        const pNorSkew = normalize(pSkew, -1, 1);

        const periodCDC = weight * (pNorAD ** 2 + pNorCV ** 2 + pNorSkew ** 2);

        trendData.push({
          date: periodDates[periodDates.length - 1],
          '综合': periodCDC
        });
      }
    }
    // 返回结果
    return NextResponse.json({
      success: true,
      data: {
        currentCDC: parseFloat(currentCDC.toFixed(4)),
        riskLevel,
        indicators: {
          av: parseFloat(av.toFixed(4)),
          ad: parseFloat(ad.toFixed(4)),
          cv: parseFloat(cv.toFixed(4)),
          skew: parseFloat(skew.toFixed(4))
        },
        changeFromLastPeriod: parseFloat((currentCDC - lastWeekCDC).toFixed(4)),
        lastWeekCDC: parseFloat(lastWeekCDC.toFixed(4)),
        maxCDC: parseFloat(maxCDC.toFixed(4)),
        changeFromMax: parseFloat((currentCDC - maxCDC).toFixed(4)),
        trend: trendData,
        evaluatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('CDC 分析 API 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
