'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, TrendingUp, AlertTriangle, CheckCircle, Activity } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

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
  const { session, isLoading: authLoading } = useAuth();
  
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date()
  });
  const [cdcData, setCdcData] = useState<CDCAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login');
    }
  }, [session, authLoading, router]);

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
      console.log('CDC API 响应:', result);
      
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
          areaStyle: { color: 'rgba(14, 165, 233, 0.3)' },
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

  // 污染物 CDC 表格数据
  const tableData = useMemo(() => {
    if (!cdcData || !cdcData.pollutants) return [];
    
    return cdcData.pollutants.map(p => ({
      pollutantName: p.pollutantName,
      av: p.av.toFixed(4),
      ad: p.ad.toFixed(4),
      cv: p.cv.toFixed(4),
      skew: p.skew.toFixed(4),
      cdc: p.cdc.toFixed(2),
      weight: (p.weight * 100).toFixed(1) + '%',
      riskLevel: p.riskLevel,
      riskColor: p.riskColor
    }));
  }, [cdcData]);

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>;
  }

  if (!session) {
    return null;
  }

  const getRiskBadgeVariant = (color: string) => {
    switch (color) {
      case 'green': return 'default';
      case 'orange': return 'secondary';
      case 'red': return 'destructive';
      default: return 'outline';
    }
  };

  const getRiskBadgeClass = (color: string) => {
    switch (color) {
      case 'green': return 'bg-green-500 text-white';
      case 'orange': return 'bg-orange-500 text-white';
      case 'red': return 'bg-red-500 text-white';
      default: return '';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CDC 综合污染指数分析</h1>
          <p className="text-muted-foreground mt-2">
            基于多指标综合评价的地下水污染风险评估
          </p>
        </div>
      </div>

      {/* 时间范围选择 */}
      <Card>
        <CardHeader>
          <CardTitle>分析周期</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start text-left">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : '开始日期'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateRange.from}
                  onSelect={(date) => setDateRange({ ...dateRange, from: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground">至</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start text-left">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : '结束日期'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateRange.to}
                  onSelect={(date) => setDateRange({ ...dateRange, to: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button onClick={fetchCDCData} disabled={loading}>
              {loading ? '分析中...' : '重新分析'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 总体 CDC 指标 */}
      {cdcData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">综合 CDC 值</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(cdcData.overallCDC || 0).toFixed(2)}</div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    分析周期: {cdcData.analysisPeriod.days} 天
                  </p>
                  {cdcData.changeFromLastPeriod !== 0 && (
                    <span className={`text-xs font-medium ${
                      cdcData.changeFromLastPeriod > 0 ? 'text-red-500' : 'text-green-500'
                    }`}>
                      {cdcData.changeFromLastPeriod > 0 ? '↑' : '↓'} 
                      {Math.abs(cdcData.changeFromLastPeriod).toFixed(2)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">风险等级</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Badge className={getRiskBadgeClass(cdcData.riskColor || 'green')}>
                  {cdcData.riskLevel || '低风险'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {cdcData.enterpriseName}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">排污口数量</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cdcData.totalOutlets || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  园区: {cdcData.parkName}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">监测污染物</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cdcData.totalPollutants || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  种污染物
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 核心指标分析 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>核心指标雷达图</CardTitle>
              </CardHeader>
              <CardContent>
                <ReactECharts option={radarOption} style={{ height: '300px' }} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CDC 组成分析</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">AV (均值) 贡献</span>
                    <span className="text-sm text-muted-foreground">
                      {((cdcData.indicators?.av?.normalized || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">AD (离差) 贡献</span>
                    <span className="text-sm text-muted-foreground">
                      {((cdcData.indicators?.ad?.normalized || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">CV (变异系数) 贡献</span>
                    <span className="text-sm text-muted-foreground">
                      {((cdcData.indicators?.cv?.normalized || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">SKEW (偏度) 贡献</span>
                    <span className="text-sm text-muted-foreground">
                      {((cdcData.indicators?.skew?.normalized || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 污染物 CDC 表格 */}
          <Card>
            <CardHeader>
              <CardTitle>各污染物 CDC 分析</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">污染物</th>
                      <th className="text-right py-3 px-4 font-medium">AV (均值)</th>
                      <th className="text-right py-3 px-4 font-medium">AD (离差)</th>
                      <th className="text-right py-3 px-4 font-medium">CV (变异系数)</th>
                      <th className="text-right py-3 px-4 font-medium">SKEW (偏度)</th>
                      <th className="text-right py-3 px-4 font-medium">权重</th>
                      <th className="text-right py-3 px-4 font-medium">CDC 值</th>
                      <th className="text-center py-3 px-4 font-medium">风险等级</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">{row.pollutantName}</td>
                        <td className="text-right py-3 px-4 font-mono">{row.av}</td>
                        <td className="text-right py-3 px-4 font-mono">{row.ad}</td>
                        <td className="text-right py-3 px-4 font-mono">{row.cv}</td>
                        <td className="text-right py-3 px-4 font-mono">{row.skew}</td>
                        <td className="text-right py-3 px-4 font-mono">{row.weight}</td>
                        <td className="text-right py-3 px-4 font-mono font-bold">{row.cdc}</td>
                        <td className="text-center py-3 px-4">
                          <Badge className={getRiskBadgeClass(row.riskColor)}>
                            {row.riskLevel}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* CDC 趋势图 */}
          <Card>
            <CardHeader>
              <CardTitle>各污染物 CDC 对比</CardTitle>
            </CardHeader>
            <CardContent>
              <ReactECharts option={lineOption} style={{ height: '400px' }} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
