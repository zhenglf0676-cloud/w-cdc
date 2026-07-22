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
  // 归一化指标（用于雷达图展示）
  norAD: number;
  norCV: number;
  norSKEW: number;
  // 最后一天的指标（用于雷达图展示）
  lastDayAv?: number;
  lastDayAd?: number;
  lastDayCv?: number;
  lastDaySkew?: number;
  lastDayNorAv?: number;
  lastDayNorAd?: number;
  lastDayNorCv?: number;
  lastDayNorSkew?: number;
  lastDayCDC?: number;
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
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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
    if (!session?.access_token || !dateRange.from || !dateRange.to) {
      console.log('CDC 数据获取跳过：', {
        hasToken: !!session?.access_token,
        hasFromDate: !!dateRange.from,
        hasToDate: !!dateRange.to
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 直接传递日期字符串（YYYY-MM-DD），避免时区转换问题
      const startDateStr = format(dateRange.from, 'yyyy-MM-dd');
      const endDateStr = format(dateRange.to, 'yyyy-MM-dd');
      
      const params = new URLSearchParams({
        startDate: startDateStr,
        endDate: endDateStr
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

  // 为每个污染物生成雷达图配置（使用最后一天的数据）
  // 为每个污染物分配不同的颜色
  const pollutantColors = [
    { line: '#3B82F6', area: 'rgba(59, 130, 246, 0.2)' },   // 蓝色
    { line: '#10B981', area: 'rgba(16, 185, 129, 0.2)' },   // 绿色
    { line: '#F59E0B', area: 'rgba(245, 158, 11, 0.2)' },   // 橙色
    { line: '#8B5CF6', area: 'rgba(139, 92, 246, 0.2)' },   // 紫色
    { line: '#EC4899', area: 'rgba(236, 72, 153, 0.2)' },   // 粉色
    { line: '#06B6D4', area: 'rgba(6, 182, 212, 0.2)' },    // 青色
  ];

  const getPollutantRadarOption = (pollutant: PollutantCDC, index: number) => {
    const color = pollutantColors[index % pollutantColors.length];
    
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
            pollutant.norAV ?? 0,
            pollutant.norAD ?? 0,
            pollutant.norCV ?? 0,
            pollutant.norSKEW ?? 0
          ],
          name: pollutant.pollutantName,
          areaStyle: { color: color.area },
          lineStyle: { color: color.line, width: 2 },
          itemStyle: { color: color.line }
        }]
      }],
      tooltip: {
        trigger: 'item',
        formatter: () => {
          const lastDayCDC = pollutant.lastDayCDC ?? pollutant.cdc;
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 8px;">${pollutant.pollutantName}</div>
              <div>AV (均值): ${pollutant.lastDayAv?.toFixed(4) ?? pollutant.av.toFixed(4)}</div>
              <div>AD (离差): ${pollutant.lastDayAd?.toFixed(4) ?? pollutant.ad.toFixed(4)}</div>
              <div>CV (变异系数): ${pollutant.lastDayCv?.toFixed(4) ?? pollutant.cv.toFixed(4)}</div>
              <div>SKEW (偏度): ${pollutant.lastDaySkew?.toFixed(4) ?? pollutant.skew.toFixed(4)}</div>
              <div style="margin-top: 8px; font-weight: bold;">CDC (最后一天): ${lastDayCDC.toFixed(4)}</div>
            </div>
          `;
        }
      }
    };
  };

  // CDC 趋势图配置（显示每日 CDC 值变化，带风险等级背景色带）
  const lineOption = useMemo(() => {
    if (!cdcData || !cdcData.pollutants || cdcData.pollutants.length === 0 || !cdcData.dailyPollutantCDC) {
      return {
        xAxis: { type: 'category', data: [] },
        yAxis: { type: 'value', name: 'CDC 值' },
        series: []
      };
    }

    // 获取所有日期并排序
    const dates = Object.keys(cdcData.dailyPollutantCDC).sort();
    
    // 如果没有日期数据，返回空配置
    if (dates.length === 0) {
      return {
        xAxis: { type: 'category', data: [] },
        yAxis: { type: 'value', name: 'CDC 值' },
        series: []
      };
    }
    
    // 格式化日期显示
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    // 计算 Y 轴最大值（至少显示到 2.0，以便显示所有风险等级）
    const allCDCValues = dates.flatMap(date => 
      cdcData.pollutants.map(p => cdcData.dailyPollutantCDC[date]?.[p.pollutantId] || 0)
    );
    const maxCDC = Math.max(...allCDCValues, 2.0);
    const yMax = Math.ceil(maxCDC * 1.2);

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
      grid: {
        left: 60,
        right: 20,
        top: 40,
        bottom: 60
      },
      xAxis: {
        type: 'category',
        data: dates.map(formatDate),
        axisLine: {
          lineStyle: {
            color: '#E2E8F0'
          }
        },
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value',
        name: 'CDC 值',
        nameLocation: 'middle',
        nameGap: 45,
        min: 0,
        max: yMax,
        axisLine: {
          lineStyle: {
            color: '#E2E8F0'
          }
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#E2E8F0'
          }
        }
      },
      series: cdcData.pollutants.map(pollutant => ({
        name: pollutant.pollutantName,
        type: 'line',
        data: dates.map(date => cdcData.dailyPollutantCDC[date]?.[pollutant.pollutantId] || 0),
        smooth: true,
        lineStyle: { width: 2.5 },
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { 
          color: getPollutantColor(cdcData.pollutants.indexOf(pollutant))
        },
        emphasis: {
          focus: 'series'
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
            <span className="text-xs text-slate-500 ml-2">（选择日期后自动往前取 7 天计算）</span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">选择日期</label>
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  setSelectedDate(newDate);
                  // 自动计算 7 天范围：从选择日期往前 7 天到选择日期
                  const fromDate = new Date(newDate);
                  fromDate.setDate(fromDate.getDate() - 7);
                  setDateRange({ from: fromDate, to: newDate });
                }}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="text-xs text-slate-500 mt-5">
              计算周期：{format(dateRange.from, 'yyyy/MM/dd')} - {format(dateRange.to, 'yyyy/MM/dd')}（7 天）
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
                      option={getPollutantRadarOption(pollutant, index)} 
                      style={{ height: '220px' }}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-500">AV (均值)</div>
                        <div className="font-mono font-medium text-slate-900">{(pollutant.lastDayAv ?? pollutant.av).toFixed(4)}</div>
                      </div>
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-500">AD (离差)</div>
                        <div className="font-mono font-medium text-slate-900">{(pollutant.lastDayAd ?? pollutant.ad).toFixed(4)}</div>
                      </div>
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-500">CV (变异系数)</div>
                        <div className="font-mono font-medium text-slate-900">{(pollutant.lastDayCv ?? pollutant.cv).toFixed(4)}</div>
                      </div>
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-500">SKEW (偏度)</div>
                        <div className="font-mono font-medium text-slate-900">{(pollutant.lastDaySkew ?? pollutant.skew).toFixed(4)}</div>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <div className="text-xs text-slate-500">CDC 值 (最后一天)</div>
                      <div className="text-lg font-bold text-slate-900">{(pollutant.lastDayCDC ?? pollutant.cdc).toFixed(2)}</div>
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
