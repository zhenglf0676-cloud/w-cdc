'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Info, Calendar } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

interface CDCData {
  currentCDC: number;
  riskLevel: string;
  evaluatedAt: string;
  changeFromLastPeriod: number;
  maxCDC: number;
  changeFromMax: number;
  lastWeekCDC: number;
  indicators: {
    AV: { current: number; lastPeriod: number; change: number };
    AD: { current: number; lastPeriod: number; change: number };
    CV: { current: number; lastPeriod: number; change: number };
    SKEW: { current: number; lastPeriod: number; change: number };
  };
  trend: any[];
  pollutants: { id: string; name: string }[];
}

export default function CDCPage() {
  const { session, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<string>('30');
  const [cdcData, setCdcData] = useState<CDCData | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  // 认证检查
  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login');
    }
  }, [session, authLoading, router]);

  // 获取 CDC 数据
  useEffect(() => {
    if (session) {
      fetchCDCData();
    }
  }, [session, timeRange]);

  const fetchCDCData = async () => {
    setLoadingData(true);
    try {
      const response = await fetch(`/api/enterprise/cdc/analysis?days=${timeRange}`, {
        headers: {
          'x-session': JSON.stringify(session),
        },
      });

      if (response.ok) {
        const result = await response.json();
        setCdcData(result.data);
      }
    } catch (error) {
      console.error('获取 CDC 数据失败:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case '低风险': return 'bg-green-100 text-green-800';
      case '中风险': return 'bg-orange-100 text-orange-800';
      case '高风险': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-green-500" />;
    return null;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-red-500';
    if (change < 0) return 'text-green-500';
    return 'text-gray-500';
  };

  // 雷达图配置
  const radarOption = useMemo(() => {
    if (!cdcData?.indicators) return {};

    const indicators = [
      { name: 'AV（平均值）', max: 1 },
      { name: 'AD（均差）', max: 1 },
      { name: 'CV（变异性）', max: 1 },
      { name: 'SKEW（偏态）', max: 1 },
    ];

    return {
      tooltip: {},
      legend: {
        data: ['本周期', '上周期'],
        bottom: 0,
      },
      radar: {
        indicator: indicators,
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          color: '#666',
        },
        splitArea: {
          areaStyle: {
            color: ['rgba(59, 130, 246, 0.05)', 'rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.2)'],
          },
        },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: [
                cdcData.indicators.AV.current,
                cdcData.indicators.AD.current,
                cdcData.indicators.CV.current,
                cdcData.indicators.SKEW.current,
              ],
              name: '本周期',
              areaStyle: {
                color: 'rgba(59, 130, 246, 0.3)',
              },
              lineStyle: {
                color: '#3B82F6',
              },
              itemStyle: {
                color: '#3B82F6',
              },
            },
            {
              value: [
                cdcData.indicators.AV.lastPeriod,
                cdcData.indicators.AD.lastPeriod,
                cdcData.indicators.CV.lastPeriod,
                cdcData.indicators.SKEW.lastPeriod,
              ],
              name: '上周期',
              areaStyle: {
                color: 'rgba(34, 197, 94, 0.1)',
              },
              lineStyle: {
                color: '#22C55E',
                type: 'dashed',
              },
              itemStyle: {
                color: '#22C55E',
              },
            },
          ],
        },
      ],
    };
  }, [cdcData]);

  // 折线图配置
  const lineOption = useMemo(() => {
    if (!cdcData?.trend || cdcData.trend.length === 0) return {};

    const dates = cdcData.trend.map(item => item.date);
    const cdcValues = cdcData.trend.map(item => item.cdc);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const data = params[0];
          return `${data.name}<br/>CDC 值：${data.value.toFixed(3)}`;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: {
          lineStyle: {
            color: '#e5e7eb',
          },
        },
        axisLabel: {
          color: '#6b7280',
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 2,
        axisLine: {
          lineStyle: {
            color: '#e5e7eb',
          },
        },
        axisLabel: {
          color: '#6b7280',
          fontSize: 11,
        },
        splitLine: {
          lineStyle: {
            color: '#f3f4f6',
          },
        },
      },
      series: [
        {
          name: 'CDC 值',
          type: 'line',
          data: cdcValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            color: '#3B82F6',
            width: 2,
          },
          itemStyle: {
            color: '#3B82F6',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              type: 'dashed',
            },
            data: [
              {
                yAxis: 0.5,
                lineStyle: { color: '#22C55E' },
                label: {
                  formatter: '低风险 (0.5)',
                  position: 'insideEndTop',
                  color: '#22C55E',
                  fontSize: 11,
                },
              },
              {
                yAxis: 1.5,
                lineStyle: { color: '#EF4444' },
                label: {
                  formatter: '高风险 (1.5)',
                  position: 'insideEndTop',
                  color: '#EF4444',
                  fontSize: 11,
                },
              },
            ],
          },
        },
      ],
    };
  }, [cdcData]);

  if (authLoading || !session) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CDC 分析</h1>
        <p className="text-sm text-gray-500 mt-1">
          基于状态 - 动作模型，评估企业地下水环境风险状态
        </p>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">时间范围</span>
              <div className="flex gap-2">
                {['7', '30', '90'].map((days) => (
                  <Button
                    key={days}
                    variant={timeRange === days ? 'default' : 'outline'}
                    onClick={() => setTimeRange(days)}
                    className="px-4"
                  >
                    近{days}天
                  </Button>
                ))}
                <Button
                  variant={timeRange === 'custom' ? 'default' : 'outline'}
                  onClick={() => setTimeRange('custom')}
                >
                  自定义
                </Button>
              </div>
            </div>

            {timeRange === 'custom' && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                />
                <span className="text-gray-500">~</span>
                <input
                  type="date"
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 当前 CDC 值 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              当前 CDC 值
              <Info className="w-4 h-4 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-orange-600">
                {cdcData?.currentCDC.toFixed(2) || '0.00'}
              </span>
              <Badge className={getRiskColor(cdcData?.riskLevel || '中风险')}>
                {cdcData?.riskLevel || '中风险'}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              <div>评估时间：{cdcData?.evaluatedAt ? new Date(cdcData.evaluatedAt).toLocaleString('zh-CN') : '暂无数据'}</div>
              <div className="flex items-center gap-1 mt-1">
                <span>较上周期：</span>
                {getChangeIcon(cdcData?.changeFromLastPeriod || 0)}
                <span className={getChangeColor(cdcData?.changeFromLastPeriod || 0)}>
                  {(cdcData?.changeFromLastPeriod || 0) > 0 ? '↑' : '↓'} {Math.abs(cdcData?.changeFromLastPeriod || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 风险等级 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              风险等级
              <Info className="w-4 h-4 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 mt-2">
              {cdcData?.riskLevel || '中风险'}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              风险范围：0.5 ≤ CDC &lt; 1.5
            </div>
          </CardContent>
        </Card>

        {/* CDC 最大值 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">CDC 最大值</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 mt-2">
              {(cdcData?.maxCDC || 0).toFixed(2)}
            </div>
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
              <span>较最高值：</span>
              {getChangeIcon(cdcData?.changeFromMax || 0)}
              <span className={getChangeColor(cdcData?.changeFromMax || 0)}>
                {(cdcData?.changeFromMax || 0) > 0 ? '↑' : '↓'} {Math.abs(cdcData?.changeFromMax || 0).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 上周 CDC 值 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">上周 CDC 值</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 mt-2">
              {(cdcData?.lastWeekCDC || 0).toFixed(2)}
            </div>
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
              <span>较上周期：</span>
              {getChangeIcon((cdcData?.currentCDC || 0) - (cdcData?.lastWeekCDC || 0))}
              <span className={getChangeColor((cdcData?.currentCDC || 0) - (cdcData?.lastWeekCDC || 0))}>
                {(cdcData?.currentCDC || 0) - (cdcData?.lastWeekCDC || 0) > 0 ? '↑' : '↓'}{' '}
                {Math.abs((cdcData?.currentCDC || 0) - (cdcData?.lastWeekCDC || 0)).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CDC 组成分析 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            CDC 组成分析
            <Info className="w-4 h-4 text-gray-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：雷达图 */}
            <div className="border border-gray-200 rounded-lg p-4">
              {cdcData?.indicators ? (
                <ReactECharts
                  option={radarOption}
                  style={{ height: '300px' }}
                  opts={{ renderer: 'svg' }}
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
                  暂无数据
                </div>
              )}
            </div>

            {/* 右侧：数据表格 */}
            <div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">指标</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">本周期值</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">上周期值</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">变化</th>
                  </tr>
                </thead>
                <tbody>
                  {cdcData?.indicators && Object.entries(cdcData.indicators).map(([key, data]) => (
                    <tr key={key} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {key === 'AV' && 'AV（平均值）'}
                        {key === 'AD' && 'AD（均差）'}
                        {key === 'CV' && 'CV（变异性）'}
                        {key === 'SKEW' && 'SKEW（偏态）'}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-gray-900">{data.current.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-500">{data.lastPeriod.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm text-right flex items-center justify-end gap-1">
                        {getChangeIcon(data.change)}
                        <span className={getChangeColor(data.change)}>
                          {data.change > 0 ? '↑' : '↓'} {Math.abs(data.change).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 text-xs text-gray-500 text-right">
                * CDC = Nor(AD)² + Nor(CV)² + Nor(SKEW)² = {cdcData?.currentCDC.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CDC 变化趋势 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">CDC 变化趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {cdcData?.trend && cdcData.trend.length > 0 ? (
            <ReactECharts
              option={lineOption}
              style={{ height: '350px' }}
              opts={{ renderer: 'svg' }}
            />
          ) : (
            <div className="h-[350px] flex items-center justify-center text-gray-500 text-sm">
              暂无数据
            </div>
          )}
          <div className="mt-4 flex justify-center gap-6 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-green-500"></span>
              低风险 (≤0.5)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-orange-500"></span>
              中风险 (0.5~1.5)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-red-500"></span>
              高风险 (≥1.5)
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
