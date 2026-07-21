'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 静态数据
const staticData = {
  currentCDC: 0.82,
  riskLevel: '中风险',
  riskRange: '0.7 ≤ CDC < 0.9',
  state: 0.68,
  action: 0.68,
  evaluationTime: '2024-07-18 10:25:30',
  changeFromLastPeriod: 0.07,
  indicators: [
    { name: 'AV（平均值）', current: 0.72, last: 0.68, change: 0.04 },
    { name: 'CV（变异性）', current: 0.81, last: 0.74, change: 0.07 },
    { name: 'Skew（偏态）', current: 0.65, last: 0.60, change: 0.05 },
    { name: 'Action（动作）', current: 0.86, last: 0.80, change: 0.06 },
    { name: 'State（状态）', current: 0.68, last: 0.63, change: 0.05 },
  ],
  cdcTrend: [
    { date: '06-18', value: 0.45 },
    { date: '06-21', value: 0.48 },
    { date: '06-24', value: 0.52 },
    { date: '06-27', value: 0.58 },
    { date: '06-30', value: 0.62 },
    { date: '07-03', value: 0.65 },
    { date: '07-06', value: 0.68 },
    { date: '07-09', value: 0.72 },
    { date: '07-12', value: 0.75 },
    { date: '07-15', value: 0.78 },
    { date: '07-18', value: 0.82 },
  ],
};

export default function CDCAnalysisPage() {
  const [timeRange, setTimeRange] = useState('30days');
  const [dateRange, setDateRange] = useState<Date | undefined>(new Date());

  const getRiskColor = (level: string) => {
    switch (level) {
      case '高风险': return 'bg-red-100 text-red-800 border-red-200';
      case '中风险': return 'bg-orange-100 text-orange-800 border-orange-200';
      case '低风险': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CDC 分析</h1>
        <p className="text-sm text-gray-500 mt-1">基于状态 - 动作模型，评估企业地下水环境风险状态</p>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* 排污口选择 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">排污口</span>
              <Select defaultValue="outlet-1">
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="选择排污口" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outlet-1">排污口 1（总排口）</SelectItem>
                  <SelectItem value="outlet-2">排污口 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 时间范围 */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-600">时间范围</span>
              <div className="flex gap-2">
                <Button
                  variant={timeRange === '7days' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('7days')}
                >
                  近 7 天
                </Button>
                <Button
                  variant={timeRange === '30days' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('30days')}
                >
                  近 30 天
                </Button>
                <Button
                  variant={timeRange === '90days' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('90days')}
                >
                  近 90 天
                </Button>
                <Button
                  variant={timeRange === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('custom')}
                >
                  自定义
                </Button>
              </div>

              {/* 自定义日期 */}
              {timeRange === 'custom' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="ml-2">
                      2024-06-18 ~ 2024-07-18
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange}
                      onSelect={setDateRange}
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 当前 CDC 值 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              当前 CDC 值
              <Info className="w-4 h-4 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-orange-600">{staticData.currentCDC}</span>
              <Badge className={getRiskColor(staticData.riskLevel)}>
                {staticData.riskLevel}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              <div>评估时间：{staticData.evaluationTime}</div>
              <div className="flex items-center gap-1 mt-1">
                较上周期：
                <TrendingUp className="w-3 h-3 text-red-500" />
                <span className="text-red-500">↑ {staticData.changeFromLastPeriod}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 风险等级 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              风险等级
              <Info className="w-4 h-4 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{staticData.riskLevel}</div>
            <div className="mt-2 text-xs text-gray-500">
              风险范围：{staticData.riskRange}
            </div>
          </CardContent>
        </Card>

        {/* 状态（S） */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">状态（S）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-600">{staticData.state}</span>
              <span className="text-sm text-gray-500">文本</span>
            </div>
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
              较上周期：
              <TrendingUp className="w-3 h-3 text-red-500" />
              <span className="text-red-500">↑ 0.05</span>
            </div>
          </CardContent>
        </Card>

        {/* 动作（A） */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">动作（A）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{staticData.action}</div>
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
              较上周期：
              <TrendingUp className="w-3 h-3 text-red-500" />
              <span className="text-red-500">↑ 0.06</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CDC 组成分析 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1">
            CDC 组成分析
            <Info className="w-4 h-4 text-gray-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：雷达图占位 */}
            <div className="flex items-center justify-center h-[300px] bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-center text-gray-500">
                <div className="text-sm mb-2">雷达图区域</div>
                <div className="text-xs">本周期 vs 上周期对比</div>
                <div className="mt-4 flex justify-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>本周期</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full border border-dashed border-green-500"></div>
                    <span>上周期</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：数据表格 */}
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">指标</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">本周期值</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">上周期值</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">变化</th>
                  </tr>
                </thead>
                <tbody>
                  {staticData.indicators.map((indicator, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-900">{indicator.name}</td>
                      <td className="py-2 px-3 text-right text-gray-900">{indicator.current}</td>
                      <td className="py-2 px-3 text-right text-gray-500">{indicator.last}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {getChangeIcon(indicator.change)}
                          <span className={indicator.change > 0 ? 'text-red-500' : indicator.change < 0 ? 'text-green-500' : 'text-gray-500'}>
                            {indicator.change > 0 ? '↑' : indicator.change < 0 ? '↓' : '-'} {Math.abs(indicator.change)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 text-xs text-gray-500 text-right">
                * CDC = Σ(权重 × 指标值) = {staticData.currentCDC}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CDC 变化趋势 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CDC 变化趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-sm mb-2">折线图区域</div>
              <div className="text-xs">CDC 值随时间变化趋势</div>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-8 h-3 bg-red-100 border border-red-200"></div>
                  <span>高风险（≥0.9）</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-8 h-3 bg-orange-100 border border-orange-200"></div>
                  <span>中风险（0.4~0.9）</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-8 h-3 bg-green-100 border border-green-200"></div>
                  <span>低风险（≤0.4）</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
