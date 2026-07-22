'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Activity,
  Factory,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import * as echarts from 'echarts';

// 类型定义
interface RankingData {
  enterpriseId: string;
  enterpriseName: string;
  industry: string;
  contactPerson: string;
  totalOutlets: number;
  totalPollutants: number;
  overallCDC: number;
  riskLevel: string;
  riskColor: string;
}

interface WarningData {
  outletId: string;
  outletName: string;
  enterpriseId: string;
  enterpriseName: string;
  time: string;
  values: Record<string, number>;
  hasWarning: boolean;
}

interface MonitoringIndicator {
  name: string;
  unit: string;
  latestValue: number;
  status: 'normal' | 'warning' | 'alarm';
  warningThreshold: number;
  alarmThreshold: number;
}

export default function AdminMonitoringPage() {
  const { session, isLoading } = useAuth();
  const [rankingData, setRankingData] = useState<RankingData[]>([]);
  const [warningData, setWarningData] = useState<WarningData[]>([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState<RankingData | null>(null);
  const [monitoringData, setMonitoringData] = useState<MonitoringIndicator[]>([]);
  const [trendData, setTrendData] = useState<Array<{
    pollutantName: string;
    dates: string[];
    values: number[];
    threshold: number;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const chartRefs = useRef<Map<string, echarts.ECharts>>(new Map());

  // 获取 CDC 风险排行
  const fetchRanking = async () => {
    if (!session?.access_token) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/monitoring/ranking', {
        headers: { 'x-auth-token': session.access_token }
      });

      if (res.ok) {
        const data = await res.json();
        setRankingData(data.data || []);
        setLastUpdateTime(new Date().toLocaleString('zh-CN'));

        // 默认选中第一个企业
        if (data.data?.length > 0 && !selectedEnterprise) {
          setSelectedEnterprise(data.data[0]);
        }
      }
    } catch (error) {
      console.error('获取 CDC 排行失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取最新预警记录
  const fetchWarnings = async () => {
    if (!session?.access_token) return;

    try {
      const res = await fetch('/api/admin/monitoring/warnings', {
        headers: { 'x-auth-token': session.access_token }
      });

      if (res.ok) {
        const data = await res.json();
        setWarningData(data.data || []);
      }
    } catch (error) {
      console.error('获取预警记录失败:', error);
    }
  };

  // 获取企业实时监测数据
  const fetchMonitoringData = async (enterpriseId: string) => {
    if (!session?.access_token) return;

    try {
      const res = await fetch(`/api/admin/monitoring/enterprise-data?enterpriseId=${enterpriseId}`, {
        headers: { 'x-auth-token': session.access_token }
      });

      if (res.ok) {
        const data = await res.json();
        setMonitoringData(data.data || []);
      } else {
        console.error('获取监测数据失败:', await res.text());
        setMonitoringData([]);
      }
    } catch (error) {
      console.error('获取监测数据失败:', error);
      setMonitoringData([]);
    }

    // 同时获取趋势数据
    fetchTrendData(enterpriseId);
  };

  useEffect(() => {
    if (!isLoading && session) {
      fetchRanking();
      fetchWarnings();
    }
  }, [isLoading, session]);

  useEffect(() => {
    if (selectedEnterprise) {
      fetchMonitoringData(selectedEnterprise.enterpriseId);
    }
  }, [selectedEnterprise]);

  // 时间范围变化时重新获取趋势数据
  useEffect(() => {
    if (selectedEnterprise) {
      fetchTrendData(selectedEnterprise.enterpriseId);
    }
  }, [timeRange]);

  // 风险等级颜色
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case '高风险': return 'text-rose-600 bg-rose-50 border-rose-200';
      case '中风险': return 'text-amber-600 bg-amber-50 border-amber-200';
      case '低风险': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  // 状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-emerald-600 bg-emerald-50';
      case 'warning': return 'text-amber-600 bg-amber-50';
      case 'alarm': return 'text-rose-600 bg-rose-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  // 状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal': return '正常';
      case 'warning': return '预警';
      case 'alarm': return '超标';
      default: return status;
    }
  };

  // 格式化时间为中国时间
  const formatChinaTime = (timeStr: string) => {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // 获取指标趋势数据
  const fetchTrendData = async (enterpriseId: string) => {
    if (!session?.access_token) return;

    try {
      const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
      const res = await fetch(`/api/admin/monitoring/trend?enterpriseId=${enterpriseId}&days=${days}`, {
        headers: {
          'x-auth-token': session.access_token,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setTrendData(data.trendData || []);
      }
    } catch (error) {
      console.error('趋势数据获取失败:', error);
    }
  };

  // 排污口颜色映射
  const outletColors = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // 渲染趋势图表
  useEffect(() => {
    if (trendData.length === 0) return;

    trendData.forEach((item, index) => {
      const chartId = `trend-chart-${index}`;
      const chartElement = document.getElementById(chartId);
      if (!chartElement) return;

      // 销毁旧图表
      const oldChart = chartRefs.current.get(chartId);
      if (oldChart) {
        oldChart.dispose();
      }

      // 创建新图表
      const chart = echarts.init(chartElement);
      chartRefs.current.set(chartId, chart);

      // 收集所有时间点
      const allTimes = new Set<string>();
      item.outlets.forEach(outlet => {
        outlet.data.forEach(d => allTimes.add(d.time));
      });
      const sortedTimes = Array.from(allTimes).sort();

      const threshold = item.threshold || 0;

      // 构建 series：每个排污口一条线
      const series = item.outlets.map((outlet, outletIndex) => {
        // 按时间排序数据
        const sortedData = [...outlet.data].sort((a, b) => a.time.localeCompare(b.time));
        // 填充缺失时间点的数据
        const dataMap = new Map(sortedData.map(d => [d.time, d.value]));
        const values = sortedTimes.map(time => dataMap.get(time) ?? null);

        const seriesItem: any = {
          name: outlet.outletName,
          type: 'line' as const,
          data: values,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: outletColors[outletIndex % outletColors.length], width: 2 },
          itemStyle: { color: outletColors[outletIndex % outletColors.length] },
        };

        // 在第一个 series 上添加阈值背景色带和阈值线
        if (outletIndex === 0 && threshold > 0) {
          seriesItem.markArea = {
            silent: true,
            data: [
              [
                {
                  yAxis: 0,
                  itemStyle: { color: 'rgba(34, 197, 94, 0.1)' }, // 绿色背景（正常）
                },
                {
                  yAxis: threshold,
                },
              ],
              [
                {
                  yAxis: threshold,
                  itemStyle: { color: 'rgba(239, 68, 68, 0.1)' }, // 红色背景（超标）
                },
                {
                  yAxis: 'max',
                },
              ],
            ],
          };
          seriesItem.markLine = {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#ef4444', type: 'dashed', width: 1 },
            label: { formatter: `阈值 ${threshold}`, position: 'end', color: '#ef4444', fontSize: 10 },
            data: [{ yAxis: threshold }],
          };
        }

        return seriesItem;
      });

      const option: echarts.EChartsOption = {
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            let html = `${params[0].name}<br/>`;
            params.forEach((p: any) => {
              if (p.value !== null && p.value !== undefined) {
                html += `${p.seriesName}: ${p.value.toFixed(2)} mg/L<br/>`;
              }
            });
            if (threshold > 0) {
              html += `阈值：${threshold} mg/L`;
            }
            return html;
          },
        },
        legend: {
          data: item.outlets.map(o => o.outletName),
          bottom: 0,
          textStyle: { fontSize: 11, color: '#64748b' },
        },
        grid: {
          left: '10%',
          right: '10%',
          bottom: '20%',
          top: '10%',
        },
        xAxis: {
          type: 'category',
          data: sortedTimes,
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          axisLabel: { color: '#64748b', fontSize: 10 },
        },
        yAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          axisLabel: { color: '#64748b', fontSize: 10 },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
        },
        series,
      };

      chart.setOption(option);
    });

    // 清理函数
    return () => {
      chartRefs.current.forEach((chart) => {
        chart.dispose();
      });
      chartRefs.current.clear();
    };
  }, [trendData]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回首页
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">实时监测（预警中心）</h1>
                <p className="text-sm text-slate-500 mt-1">
                  基于状态 - 动作模型，评估企业地下水环境风险状态
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* 数据更新时间 */}
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Activity className="h-4 w-4" />
                <span>数据更新时间：{lastUpdateTime || '加载中...'}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchRanking}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* 时间范围选择器 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">时间范围：</span>
                <Button
                  variant={timeRange === '24h' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('24h')}
                >
                  近 24 小时
                </Button>
                <Button
                  variant={timeRange === '7d' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('7d')}
                >
                  近 7 天
                </Button>
                <Button
                  variant={timeRange === '30d' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('30d')}
                >
                  近 30 天
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧：CDC 风险排行 */}
          <div className="col-span-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    CDC 风险排行（实时）
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchRanking}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rankingData.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      暂无数据
                    </div>
                  ) : (
                    rankingData.map((enterprise, index) => (
                      <div
                        key={enterprise.enterpriseId}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedEnterprise?.enterpriseId === enterprise.enterpriseId
                            ? 'border-sky-500 bg-sky-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedEnterprise(enterprise)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                              index < 3 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {index + 1}
                            </div>
                            <span className="font-medium text-slate-900">
                              {enterprise.enterpriseName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-900">
                              {enterprise.overallCDC.toFixed(2)}
                            </span>
                            <Badge className={getRiskColor(enterprise.riskLevel)}>
                              {enterprise.riskLevel}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {rankingData.length > 0 && (
                  <Button variant="outline" className="w-full mt-4">
                    查看全部企业
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：企业详情 */}
          <div className="col-span-8 space-y-6">
            {selectedEnterprise ? (
              <>
                {/* 企业基本信息卡片 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-slate-900">
                        企业详情：{selectedEnterprise.enterpriseName}
                      </CardTitle>
                      <Button variant="outline" size="sm">
                        切换企业
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div className={`p-4 rounded-lg border ${
                        selectedEnterprise.riskLevel === '高风险' ? 'bg-red-50 border-red-200' :
                        selectedEnterprise.riskLevel === '中风险' ? 'bg-amber-50 border-amber-200' :
                        'bg-emerald-50 border-emerald-200'
                      }`}>
                        <div className="text-sm text-slate-600 mb-1">当前 CDC</div>
                        <div className={`text-3xl font-bold ${
                          selectedEnterprise.riskLevel === '高风险' ? 'text-red-600' :
                          selectedEnterprise.riskLevel === '中风险' ? 'text-amber-600' :
                          'text-emerald-600'
                        }`}>
                          {selectedEnterprise.overallCDC.toFixed(2)}
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg border ${
                        selectedEnterprise.riskLevel === '高风险' ? 'bg-red-50 border-red-200' :
                        selectedEnterprise.riskLevel === '中风险' ? 'bg-amber-50 border-amber-200' :
                        'bg-emerald-50 border-emerald-200'
                      }`}>
                        <div className="text-sm text-slate-600 mb-1">风险等级</div>
                        <div className={`text-xl font-bold ${
                          selectedEnterprise.riskLevel === '高风险' ? 'text-red-600' :
                          selectedEnterprise.riskLevel === '中风险' ? 'text-amber-600' :
                          'text-emerald-600'
                        }`}>
                          {selectedEnterprise.riskLevel}
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border border-slate-200">
                        <div className="text-sm text-slate-600 mb-1">排污口数量</div>
                        <div className="text-2xl font-bold text-slate-900">
                          {selectedEnterprise.totalOutlets}
                          <span className="text-emerald-500 text-sm ml-1">↑</span>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border border-slate-200">
                        <div className="text-sm text-slate-600 mb-1">负责人</div>
                        <div className="text-lg font-medium text-slate-900">
                          {selectedEnterprise.contactPerson || '未知'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 实时监测数据 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-slate-900">
                        实时监测数据（最新）
                      </CardTitle>
                      <Button variant="link" size="sm">
                        查看全部指标
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">监测指标</th>
                            {monitoringData.map((indicator) => (
                              <th key={indicator.name} className="text-center py-3 px-4 text-sm font-medium text-slate-600">
                                {indicator.name} ({indicator.unit})
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-200">
                            <td className="py-3 px-4 text-sm font-medium text-slate-900">最新值</td>
                            {monitoringData.map((indicator) => (
                              <td key={indicator.name} className="text-center py-3 px-4 text-sm font-bold text-slate-900">
                                {indicator.latestValue}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-3 px-4 text-sm font-medium text-slate-900">状态</td>
                            {monitoringData.map((indicator) => (
                              <td key={indicator.name} className="text-center py-3 px-4">
                                <Badge className={getStatusColor(indicator.status)}>
                                  {getStatusText(indicator.status)}
                                </Badge>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* 指标趋势 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-slate-900">
                        指标趋势（近 {timeRange === '24h' ? '24 小时' : timeRange === '7d' ? '7 天' : '30 天'}）
                      </CardTitle>
                      <Button variant="link" size="sm">
                        查看全部趋势
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {trendData.length === 0 ? (
                      <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
                        暂无趋势数据
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {trendData.slice(0, 4).map((item, index) => (
                          <div key={`trend-${index}`} className="p-4 border border-slate-200 rounded-lg">
                            <div className="text-sm font-medium text-slate-900 mb-2">
                              {item.pollutantName} (mg/L)
                            </div>
                            <div id={`trend-chart-${index}`} className="h-48" />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-slate-500">
                  请从左侧选择一个企业查看详情
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 最新预警记录 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              最新预警记录（今日超标）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">时间</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">企业名称</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">排污口</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">超标污染物</th>
                  </tr>
                </thead>
                <tbody>
                  {warningData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-500">
                        今日暂无超标记录
                      </td>
                    </tr>
                  ) : (
                    warningData.map((warning, index) => {
                      // 获取超标的污染物列表
                      const exceededPollutants = Object.entries(warning.pollutants || {}).map(([type, data]) => ({
                        type,
                        value: (data as any).value,
                        threshold: (data as any).threshold,
                      }));

                      return (
                        <tr key={index} className="border-b border-slate-100">
                          <td className="py-3 px-4 text-sm text-slate-900">{formatChinaTime(warning.time)}</td>
                          <td className="py-3 px-4 text-sm font-medium text-slate-900">{warning.enterpriseName}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{warning.outletName}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-2">
                              {exceededPollutants.map((p) => (
                                <Badge key={p.type} className="bg-red-100 text-red-700 border-red-200">
                                  {p.type}: {p.value.toFixed(3)} mg/L (阈值：{p.threshold} mg/L)
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
