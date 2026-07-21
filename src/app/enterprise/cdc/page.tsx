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

  // 雷达图配置
  const radarOption = useMemo(() => {
    if (!cdcData || !cdcData.indicators) {
      return {
        radar: { indicator: [] },
        series: [{ data: [] }]
      };
    }

    return {
      radar: {
        indicator: [
          { name: 'AV (均值)', max: 1 },
          { name: 'AD (离差)', max: 1 },
          { name: 'CV (变异系数)', max: 1 },
          { name: 'SKEW (偏度)', max: 1 }
        ],
        radius: '65%'
      },
      series: [{
        type: 'radar',
        data: [{
          value: [
            cdcData.indicators.av.normalized,
            cdcData.indicators.ad.normalized,
            cdcData.indicators.cv.normalized,
            cdcData.indicators.skew.normalized
          ],
          name: '当前指标',
          areaStyle: { color: 'rgba(14, 165, 233, 0.2)' },
          lineStyle: { color: '#0EA5E9', width: 2 },
          itemStyle: { color: '#0EA5E9' }
        }]
      }],
      tooltip: {
        trigger: 'item'
      }
    };
  }, [cdcData]);

  // CDC 趋势图配置
  const lineOption = useMemo(() => {
    if (!cdcData || !cdcData.pollutants || cdcData.pollutants.length === 0) {
      return {
        xAxis: { data: [] },
        series: []
      };
    }

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          let result = `${params[0].axisValue}<br/>`;
          params.forEach((param: any) => {
            const value = param.value !== undefined && param.value !== null ? param.value.toFixed(2) : '0.00';
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
        data: ['当前周期']
      },
      yAxis: {
        type: 'value',
        name: 'CDC 值'
      },
      series: cdcData.pollutants.map(pollutant => ({
        name: pollutant.pollutantName,
        type: 'line',
        data: [pollutant.cdc],
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

            {/* 核心指标分析 */}
            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* 雷达图 */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-4 font-semibold text-slate-900">核心指标雷达图</h3>
                <ReactECharts option={radarOption} style={{ height: '280px' }} />
              </div>

              {/* CDC 组成分析 */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-4 font-semibold text-slate-900">CDC 组成分析</h3>
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-slate-600">AV (均值) 贡献</span>
                      <span className="text-sm font-medium text-slate-900">
                        {((cdcData.indicators?.av?.normalized || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div 
                        className="h-full bg-sky-500"
                        style={{ width: `${(cdcData.indicators?.av?.normalized || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-slate-600">AD (离差) 贡献</span>
                      <span className="text-sm font-medium text-slate-900">
                        {((cdcData.indicators?.ad?.normalized || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div 
                        className="h-full bg-sky-500"
                        style={{ width: `${(cdcData.indicators?.ad?.normalized || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-slate-600">CV (变异系数) 贡献</span>
                      <span className="text-sm font-medium text-slate-900">
                        {((cdcData.indicators?.cv?.normalized || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div 
                        className="h-full bg-sky-500"
                        style={{ width: `${(cdcData.indicators?.cv?.normalized || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-slate-600">SKEW (偏度) 贡献</span>
                      <span className="text-sm font-medium text-slate-900">
                        {((cdcData.indicators?.skew?.normalized || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div 
                        className="h-full bg-sky-500"
                        style={{ width: `${(cdcData.indicators?.skew?.normalized || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 各污染物 CDC 分析表格 */}
            <div className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">各污染物 CDC 分析</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">污染物</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">AV (均值)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">AD (离差)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">CV (变异系数)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">SKEW (偏度)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">权重</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">CDC 值</th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">风险等级</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {cdcData.pollutants.map((pollutant, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
                          {pollutant.pollutantName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-mono text-slate-600">
                          {pollutant.av.toFixed(4)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-mono text-slate-600">
                          {pollutant.ad.toFixed(4)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-mono text-slate-600">
                          {pollutant.cv.toFixed(4)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-mono text-slate-600">
                          {pollutant.skew.toFixed(4)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-mono text-slate-600">
                          {(pollutant.weight * 100).toFixed(1)}%
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-mono font-semibold text-slate-900">
                          {pollutant.cdc.toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                            getRiskColor(pollutant.riskColor).bg
                          } ${getRiskColor(pollutant.riskColor).text} ${
                            getRiskColor(pollutant.riskColor).border
                          }`}>
                            {pollutant.riskLevel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
