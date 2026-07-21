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
    av: number;
    ad: number;
    cv: number;
    skew: number;
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
          'x-auth-token': session!.access_token,
        },
      });

      console.log('CDC API 响应状态:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('CDC API 返回数据:', result);
        setCdcData(result.data);
      } else {
        const errorText = await response.text();
        console.error('CDC API 错误:', response.status, errorText);
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
    const defaultOption = {
      radar: {
        indicator: [
          { name: 'AV（平均值）', max: 1 },
          { name: 'AD（均差）', max: 1 },
          { name: 'CV（变异性）', max: 1 },
          { name: 'SKEW（偏态）', max: 1 },
        ],
      },
      series: [{ type: 'radar', data: [] }],
    };

    if (!cdcData?.indicators) return defaultOption;

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
                cdcData.indicators?.av || 0,
                cdcData.indicators?.ad || 0,
                cdcData.indicators?.cv || 0,
                cdcData.indicators?.skew || 0,
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
                cdcData.indicators?.av || 0,
                cdcData.indicators?.ad || 0,
                cdcData.indicators?.cv || 0,
                cdcData.indicators?.skew || 0,
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
    const defaultOption = {
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value' },
      series: [],
    };

    if (!cdcData?.trend || cdcData.trend.length === 0) return defaultOption;

    const dates = cdcData.trend.map(item => item.date);

    // 从 trend 数据中提取污染物 ID
    const pollutantIds = cdcData.trend[0] ? Object.keys(cdcData.trend[0])
      .filter(key => key !== 'date' && key !== '综合') : [];

    // 为每个污染物创建一条线
    const series = pollutantIds.map(pollutantId => {
      return {
        name: pollutantId.toUpperCase(),
        type: 'line',
        data: cdcData.trend.map(item => item[pollutantId] || 0),
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: {
          width: 1.5,
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
              { offset: 0, color: 'rgba(59, 130, 246, 0.15)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0)' },
            ],
          },
        },
      };
    });

    // 添加综合线
    const cdcValues = cdcData.trend.map(item => item['综合'] || 0);
    series.push({
      name: '综合 CDC',
      type: 'line',
      data: cdcValues,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        color: '#3B82F6',
        width: 2.5,
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
            { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0)' },
          ],
        },
      },
    });

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          const date = new Date(params[0].name);
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
          let result = `<div style="font-weight: 600; margin-bottom: 8px;">${dateStr}</div>`;
          params.forEach((p: any) => {
            if (p.value !== undefined && p.value !== null) {
              result += `<div style="display: flex; align-items: center; margin-bottom: 4px;">
                ${p.marker}
                <span style="margin-left: 4px;">${p.seriesName}：</span>
                <span style="margin-left: auto; font-weight: 600;">${Number(p.value).toFixed(3)}</span>
              </div>`;
            }
          });
          return result;
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
                {(cdcData?.currentCDC || 0).toFixed(2)}
              </span>
              <Badge className={getRiskColor(cdcData?.riskLevel || '低风险')}>
                {cdcData?.riskLevel || '低风险'}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              <div>评估时间：{cdcData?.evaluatedAt ? (() => {
                const date = new Date(cdcData.evaluatedAt);
                const localDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
                return localDate.toISOString().slice(0, 16).replace('T', ' ');
              })() : '暂无数据'}</div>
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
                  {cdcData?.indicators ? (
                    <>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm text-gray-900">AV（平均值）</td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">{(cdcData.indicators.av || 0).toFixed(4)}</td>
                        <td className="py-3 px-4 text-sm text-right text-gray-500">-</td>
                        <td className="py-3 px-4 text-sm text-right">-</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm text-gray-900">AD（均差）</td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">{(cdcData.indicators.ad || 0).toFixed(4)}</td>
                        <td className="py-3 px-4 text-sm text-right text-gray-500">-</td>
                        <td className="py-3 px-4 text-sm text-right">-</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm text-gray-900">CV（变异性）</td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">{(cdcData.indicators.cv || 0).toFixed(4)}</td>
                        <td className="py-3 px-4 text-sm text-right text-gray-500">-</td>
                        <td className="py-3 px-4 text-sm text-right">-</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm text-gray-900">SKEW（偏态）</td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">{(cdcData.indicators.skew || 0).toFixed(4)}</td>
                        <td className="py-3 px-4 text-sm text-right text-gray-500">-</td>
                        <td className="py-3 px-4 text-sm text-right">-</td>
                      </tr>
                    </>
                  ) : null}
                </tbody>
              </table>
              <div className="mt-4 text-xs text-gray-500 text-right">
                * CDC = Nor(AD)² + Nor(CV)² + Nor(SKEW)² = {(cdcData?.currentCDC || 0).toFixed(2)}
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
