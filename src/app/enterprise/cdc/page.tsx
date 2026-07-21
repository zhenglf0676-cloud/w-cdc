'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Info, Calendar } from 'lucide-react';

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
  const { session, loading } = useAuth();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<string>('30');
  const [cdcData, setCdcData] = useState<CDCData | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  // 认证检查
  useEffect(() => {
    if (!loading && !session) {
      router.push('/login');
    }
  }, [session, loading, router]);

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

  if (loading || !session) {
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
                  {cdcData?.changeFromLastPeriod > 0 ? '↑' : '↓'} {Math.abs(cdcData?.changeFromLastPeriod || 0).toFixed(2)}
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
              {cdcData?.maxCDC.toFixed(2) || '0.00'}
            </div>
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
              <span>较最高值：</span>
              {getChangeIcon(cdcData?.changeFromMax || 0)}
              <span className={getChangeColor(cdcData?.changeFromMax || 0)}>
                {cdcData?.changeFromMax > 0 ? '↑' : '↓'} {Math.abs(cdcData?.changeFromMax || 0).toFixed(2)}
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
              {cdcData?.lastWeekCDC.toFixed(2) || '0.00'}
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
            {/* 左侧：雷达图占位 */}
            <div className="border border-gray-200 rounded-lg p-6 flex items-center justify-center min-h-[300px]">
              <div className="text-center text-gray-500">
                <div className="text-sm mb-2">雷达图</div>
                <div className="text-xs">AV、AD、CV、SKEW 四维度对比</div>
                <div className="mt-4 flex justify-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                    本周期
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-green-500 rounded-full border border-dashed"></span>
                    上周期
                  </span>
                </div>
              </div>
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
          <div className="border border-gray-200 rounded-lg p-6 min-h-[300px] flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-sm mb-2">折线图</div>
              <div className="text-xs">显示各污染物 CDC 值随时间变化</div>
              <div className="mt-4 flex justify-center gap-4 text-xs flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-500"></span>
                  综合 CDC
                </span>
                {cdcData?.pollutants.map(p => (
                  <span key={p.id} className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-gray-400"></span>
                    {p.name}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-100 border border-red-300"></span>
                  高风险 (≥1.5)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-orange-100 border border-orange-300"></span>
                  中风险 (0.5~1.5)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-green-100 border border-green-300"></span>
                  低风险 (≤0.5)
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
