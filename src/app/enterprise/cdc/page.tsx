'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import ReactECharts from 'echarts-for-react';
import {
  ChevronLeft,
  CalendarIcon,
  Activity,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

interface PollutantCDC {
  pollutantId: string;
  pollutantName: string;
  av: number;
  ad: number;
  cv: number;
  skew: number;
  cdc: number;
  weight: number;
  riskLevel: string;
  riskColor: string;
}

interface CDCAnalysisData {
  enterpriseId: string;
  enterpriseName: string;
  parkName: string;
  analysisPeriod: { days: number; startDate: string; endDate: string };
  totalOutlets: number;
  totalPollutants: number;
  overallCDC: number;
  lastPeriodCDC: number;
  changeFromLastPeriod: number;
  riskLevel: string;
  riskColor: string;
  pollutants: PollutantCDC[];
  dailyPollutantCDC: Record<string, Record<string, number>>;
  indicators: {
    av: { current: number; normalized: number };
    ad: { current: number; normalized: number };
    cv: { current: number; normalized: number };
    skew: { current: number; normalized: number };
  };
}

export default function CDCPage() {
  const router = useRouter();
  const { user, session, isLoading } = useAuth();
  
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date()
  });
  const [cdcData, setCdcData] = useState<CDCAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const companyName = user?.user_metadata?.company_name || user?.email || '企业用户';

  // 认证检查
  useEffect(() => {
    if (!isLoading && !user) {
      setRedirecting(true);
      router.push('/login');
      return;
    }
    if (!isLoading && user?.user_metadata?.role !== 'enterprise') {
      setRedirecting(true);
      router.push('/admin');
      return;
    }
  }, [user, isLoading, router]);

  const fetchCDCData = async () => {
    if (!session || !dateRange.from || !dateRange.to) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString()
      });

      const response = await fetch(`/api/enterprise/cdc/analysis?${params}`, {
        headers: {
          'x-auth-token': session.access_token
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '获取 CDC 分析数据失败');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setCdcData(result.data);
      } else {
        throw new Error(result.error || '获取 CDC 分析数据失败');
      }
    } catch (err) {
      console.error('CDC API 错误:', err);
      setError(err instanceof Error ? err.message : '获取 CDC 分析数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session && dateRange.from && dateRange.to) {
      fetchCDCData();
    }
  }, [session, dateRange]);

  // 为每个污染物生成雷达图配置（使用当天的数据）
  const getPollutantRadarOption = (pollutant: PollutantCDC) => {
    // 获取最后一天的 CDC 数据
    const dates = Object.keys(cdcData?.dailyPollutantCDC || {}).sort();
    const lastDate = dates[dates.length - 1];
    const lastDayCDC = cdcData?.dailyPollutantCDC?.[lastDate]?.[pollutant.pollutantId] || 0;
    
    // 使用整个周期的平均值作为雷达图数据（因为当天可能没有足够数据计算四个指标）
    // 但 CDC 值使用当天的
    return {
      radar: {
        indicator: [
          { name: 'AV', max: 1 },
          { name: 'AD', max: 1 },
          { name: 'CV', max: 1 },
          { name: 'SKEW', max: 1 }
        ],
        radius: '60%',
        center: ['50%', '50%']
      },
      series: [{
        type: 'radar',
        data: [{
          value: [
            pollutant.av / 10 || 0.5,
            pollutant.ad / 10 || 0.5,
            pollutant.cv / 10 || 0.5,
            pollutant.skew / 10 || 0.5
          ],
          name: pollutant.pollutantName,
          areaStyle: { 
            color: pollutant.riskColor === 'green' ? 'rgba(16, 185, 129, 0.2)' :
                   pollutant.riskColor === 'orange' ? 'rgba(245, 158, 11, 0.2)' :
                   'rgba(239, 68, 68, 0.2)'
          },
          lineStyle: { 
            color: pollutant.riskColor === 'green' ? '#10B981' :
                   pollutant.riskColor === 'orange' ? '#F59E0B' : '#EF4444',
            width: 2 
          },
          itemStyle: { 
            color: pollutant.riskColor === 'green' ? '#10B981' :
                   pollutant.riskColor === 'orange' ? '#F59E0B' : '#EF4444'
          }
        }]
      }],
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (!params || !params.value) return '';
          const value = lastDayCDC.toFixed(4);
          return `${pollutant.pollutantName}<br/>CDC: ${value}`;
        }
      }
    };
  };

  // CDC 趋势图配置（显示每日 CDC 值变化）
  const lineOption = useMemo(() => {
    if (!cdcData || !cdcData.pollutants || cdcData.pollutants.length === 0 || !cdcData.dailyPollutantCDC) {
      return {
        xAxis: { data: [] },
        series: []
      };
    }

    // 获取所有日期并排序
    const dates = Object.keys(cdcData.dailyPollutantCDC).sort();
    
    // 格式化日期显示
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          let result = `${params[0].axisValue}<br/>`;
          params.forEach((param: any) => {
            const value = param.value !== undefined && param.value !== null ? param.value.toFixed(4) : '0.0000';
            result += `${param.marker} ${param.seriesName}: ${value}<br/>`;
          });
          return result;
        }
      },
      legend: {
        data: cdcData.pollutants.map(p => p.pollutantName),
        bottom: 0
      },
      xAxis: {
        type: 'category',
        data: dates.map(formatDate),
        name: '日期'
      },
      yAxis: {
        type: 'value',
        name: 'CDC 值'
      },
      series: cdcData.pollutants.map(pollutant => ({
        name: pollutant.pollutantName,
        type: 'line',
        data: dates.map(date => cdcData.dailyPollutantCDC[date]?.[pollutant.pollutantId] || 0),
        smooth: true,
        lineStyle: { width: 2 },
        itemStyle: { 
          color: pollutant.riskColor === 'green' ? '#10B981' : 
                 pollutant.riskColor === 'orange' ? '#F59E0B' : '#EF4444'
        }
      }))
    };
  }, [cdcData]);

  if (isLoading || redirecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!user) return null;

  const getRiskColor = (color: string) => {
    switch (color) {
      case 'green': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
      case 'orange': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
      case 'red': return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
      default: return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Top Bar */}
      <header className="flex h-14 items-center justify-between border-b bg-white px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/enterprise')}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft className="h-4 w-4" />
            返回首页
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">CDC 综合污染指数分析</h1>
            <p className="text-xs text-slate-500">基于多指标综合评价的地下水污染风险评估</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{companyName}</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
            {companyName.charAt(0)}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* 时间范围选择 */}
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-slate-500" />
            <h3 className="font-semibold text-slate-900">分析周期</h3>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">开始日期</label>
              <input
                type="date"
                value={format(dateRange.from, 'yyyy-MM-dd')}
                onChange={(e) => setDateRange({ ...dateRange, from: new Date(e.target.value) })}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">结束日期</label>
              <input
                type="date"
                value={format(dateRange.to, 'yyyy-MM-dd')}
                onChange={(e) => setDateRange({ ...dateRange, to: new Date(e.target.value) })}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <button
              onClick={fetchCDCData}
              disabled={loading}
              className="mt-5 rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {loading ? '分析中...' : '重新分析'}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* CDC 数据展示 */}
        {cdcData && (
          <>
            {/* 总体指标卡片 */}
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* 综合 CDC 值 */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-500">综合 CDC 值</span>
                  <Activity className="h-4 w-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {(cdcData.overallCDC || 0).toFixed(2)}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    周期: {cdcData.analysisPeriod.days} 天
                  </span>
                  {cdcData.changeFromLastPeriod !== 0 && (
                    <span className={`flex items-center gap-0.5 text-xs font-medium ${
                      cdcData.changeFromLastPeriod > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {cdcData.changeFromLastPeriod > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(cdcData.changeFromLastPeriod).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* 风险等级 */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-500">风险等级</span>
                  <AlertTriangle className="h-4 w-4 text-slate-400" />
                </div>
                <div className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${
                  getRiskColor(cdcData.riskColor || 'green').bg
                } ${getRiskColor(cdcData.riskColor || 'green').text} ${
                  getRiskColor(cdcData.riskColor || 'green').border
                }`}>
                  {cdcData.riskLevel || '低风险'}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {cdcData.enterpriseName}
                </div>
              </div>

              {/* 排污口数量 */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-500">排污口数量</span>
                  <CheckCircle className="h-4 w-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {cdcData.totalOutlets || 0}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  园区: {cdcData.parkName}
                </div>
              </div>

              {/* 监测污染物 */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-500">监测污染物</span>
                  <CheckCircle className="h-4 w-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {cdcData.totalPollutants || 0}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  种污染物
                </div>
              </div>
            </div>

            {/* 各污染物 CDC 雷达图 */}
            <div className="mb-6">
              <h3 className="mb-4 font-semibold text-slate-900">各污染物 CDC 分析</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cdcData.pollutants.map((pollutant, index) => (
                  <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="font-medium text-slate-900">{pollutant.pollutantName}</h4>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                        getRiskColor(pollutant.riskColor).bg
                      } ${getRiskColor(pollutant.riskColor).text} ${
                        getRiskColor(pollutant.riskColor).border
                      }`}>
                        {pollutant.riskLevel}
                      </span>
                    </div>
                    <ReactECharts 
                      option={getPollutantRadarOption(pollutant)} 
                      style={{ height: '220px' }}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-500">AV (均值)</div>
                        <div className="font-mono font-medium text-slate-900">{pollutant.av.toFixed(4)}</div>
                      </div>
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-500">AD (离差)</div>
                        <div className="font-mono font-medium text-slate-900">{pollutant.ad.toFixed(4)}</div>
                      </div>
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-500">CV (变异系数)</div>
                        <div className="font-mono font-medium text-slate-900">{pollutant.cv.toFixed(4)}</div>
                      </div>
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-500">SKEW (偏度)</div>
                        <div className="font-mono font-medium text-slate-900">{pollutant.skew.toFixed(4)}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <div>
                        <div className="text-xs text-slate-500">CDC 值</div>
                        <div className="text-lg font-bold text-slate-900">{pollutant.cdc.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">权重</div>
                        <div className="text-sm font-medium text-slate-700">{(pollutant.weight * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CDC 趋势图 */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-900">各污染物 CDC 对比</h3>
              <ReactECharts option={lineOption} style={{ height: '350px' }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
