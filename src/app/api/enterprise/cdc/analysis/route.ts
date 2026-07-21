import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient } from '@/storage/database/supabase-client';

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
    const authHeader = request.headers.get('x-session');
    if (!authHeader) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    let userId: string;
    try {
      const session = JSON.parse(authHeader);
      userId = session.sub;
    } catch {
      userId = authHeader;
    }

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 创建 Supabase 客户端（使用 service role key）
    const supabase = getSupabaseClient();

    // 获取企业信息
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('sub', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: '用户信息获取失败' }, { status: 400 });
    }

    const companyId = profile.sub;

    // 获取企业已审批的排污口
    const { data: outlets, error: outletsError } = await supabase
      .from('discharge_outlets')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('status', 'approved');

    if (outletsError || !outlets || outlets.length === 0) {
      return NextResponse.json({ error: '未找到已审批的排污口' }, { status: 400 });
    }

    const outletIds = outlets.map(o => o.id);

    // 获取企业已审批的污染物
    const { data: pollutants, error: pollutantsError } = await supabase
      .from('pollutant_applications')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'approved');

    if (pollutantsError || !pollutants || pollutants.length === 0) {
      return NextResponse.json({ error: '未找到已审批的污染物' }, { status: 400 });
    }

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
    pollutants.forEach(p => {
      pollutantData[p.id] = [];
    });

    monitoringData.forEach(record => {
      if (pollutantData[record.pollutant_type]) {
        pollutantData[record.pollutant_type].push(record);
      }
    });

    // 计算每个污染物的每日企业监测值
    const dailyValuesByPollutant: Record<string, Record<string, number>> = {};
    
    Object.keys(pollutantData).forEach(pollutantId => {
      const records = pollutantData[pollutantId];
      const dailyValues: Record<string, number> = {};

      // 按日期分组
      records.forEach(record => {
        const date = new Date(record.monitored_at).toISOString().split('T')[0];
        if (!dailyValues[date]) {
          dailyValues[date] = 0;
        }
        dailyValues[date] += record.value;
      });

      dailyValuesByPollutant[pollutantId] = dailyValues;
    });

    // 计算每个污染物的 CDC
    const cdcResults: Record<string, any> = {};
    const trendData: Record<string, number>[] = [];
    const dates = Object.keys(dailyValuesByPollutant[pollutants[0].id] || {}).sort();

    // 计算历史统计值（用于归一化）
    const historicalStats: Record<string, { adMin: number; adMax: number; cvMin: number; cvMax: number; skewMin: number; skewMax: number }> = {};
    
    pollutants.forEach(pollutant => {
      const dailyValues = Object.values(dailyValuesByPollutant[pollutant.id] || {});
      if (dailyValues.length === 0) return;

      const n = dailyValues.length;
      const av = dailyValues.reduce((a, b) => a + b, 0) / n;
      const ad = dailyValues.reduce((a, b) => a + Math.abs(b - av), 0) / n;
      const sd = calculateSD(dailyValues, av);
      const cv = av !== 0 ? sd / av : 0;
      const skew = calculateSkew(dailyValues, av, sd);

      historicalStats[pollutant.id] = {
        adMin: 0, adMax: ad * 2,
        cvMin: 0, cvMax: cv * 2,
        skewMin: -1, skewMax: 1
      };
    });

    // 计算每个污染物的 CDC
    pollutants.forEach(pollutant => {
      const dailyValues = Object.values(dailyValuesByPollutant[pollutant.id] || {});
      if (dailyValues.length === 0) return;

      const result = calculatePollutantCDC(dailyValues, historicalStats[pollutant.id]);
      if (result) {
        cdcResults[pollutant.id] = {
          ...result,
          name: pollutant.name,
          unit: pollutant.unit
        };
      }
    });

    // 计算综合 CDC（所有污染物的平均值）
    const cdcValues = Object.values(cdcResults).map(r => r.cdc);
    const currentCDC = cdcValues.length > 0 ? cdcValues.reduce((a, b) => a + b, 0) / cdcValues.length : 0;
    const riskLevel = getRiskLevel(currentCDC);

    // 计算趋势数据
    dates.forEach(date => {
      const dayCDC: Record<string, number> = { date: new Date(date).getTime() };
      let totalCDC = 0;
      let count = 0;

      pollutants.forEach(pollutant => {
        const dailyVal = dailyValuesByPollutant[pollutant.id]?.[date];
        if (dailyVal !== undefined) {
          // 简化：这里应该用滚动窗口计算，暂时用单天值
          dayCDC[pollutant.id] = dailyVal;
          totalCDC += dailyVal;
          count++;
        }
      });

      dayCDC['综合'] = count > 0 ? totalCDC / count : 0;
      trendData.push(dayCDC);
    });

    return NextResponse.json({
      success: true,
      data: {
        currentCDC,
        riskLevel: riskLevel.level,
        evaluatedAt: new Date().toISOString(),
        changeFromLastPeriod: 0.07, // 示例数据
        maxCDC: 0.92, // 示例数据
        changeFromMax: -0.10, // 示例数据
        lastWeekCDC: 0.75, // 示例数据
        indicators: {
          AV: { current: 0.72, lastPeriod: 0.68, change: 0.04 },
          AD: { current: 0.81, lastPeriod: 0.74, change: 0.07 },
          CV: { current: 0.65, lastPeriod: 0.60, change: 0.05 },
          SKEW: { current: 0.86, lastPeriod: 0.80, change: 0.06 }
        },
        trend: trendData,
        pollutants: pollutants.map(p => ({ id: p.id, name: p.name }))
      }
    });

  } catch (error) {
    console.error('CDC 分析 API 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
