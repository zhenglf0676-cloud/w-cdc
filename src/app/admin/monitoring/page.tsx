'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  Building2, 
  Droplets, 
  Factory, 
  User,
  ChevronRight,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 模拟数据
const mockRankingData = [
  { rank: 1, name: '重庆 BB 电镀有限公司', cdc: 0.91, risk: '高风险', riskColor: 'red' },
  { rank: 2, name: '重庆 DD 印染有限公司', cdc: 0.87, risk: '高风险', riskColor: 'red' },
  { rank: 3, name: '重庆 XX 科技有限公司', cdc: 0.82, risk: '中风险', riskColor: 'orange' },
  { rank: 4, name: '重庆 YY 化工有限公司', cdc: 0.76, risk: '中风险', riskColor: 'orange' },
  { rank: 5, name: '重庆 AA 电子材料有限公司', cdc: 0.63, risk: '中风险', riskColor: 'orange' },
  { rank: 6, name: '重庆 EE 塑料制品有限公司', cdc: 0.52, risk: '低风险', riskColor: 'green' },
  { rank: 7, name: '重庆 ZZ 机械制造有限公司', cdc: 0.45, risk: '低风险', riskColor: 'green' },
  { rank: 8, name: '重庆 CC 食品有限公司', cdc: 0.38, risk: '低风险', riskColor: 'green' },
  { rank: 9, name: '重庆 GG 新材料有限公司', cdc: 0.34, risk: '低风险', riskColor: 'green' },
  { rank: 10, name: '重庆 HH 纸业有限公司', cdc: 0.28, risk: '低风险', riskColor: 'green' },
];

const mockMonitoringData = [
  { indicator: 'pH (无量纲)', value: 7.32, status: '正常', limit: '6.00-9.00' },
  { indicator: 'COD (mg/L)', value: 18.6, status: '正常', limit: '≤30.0' },
  { indicator: '氨氮 (mg/L)', value: 1.12, status: '正常', limit: '≤1.50' },
  { indicator: '总磷 (mg/L)', value: 0.23, status: '正常', limit: '≤0.30' },
  { indicator: '总氮 (mg/L)', value: 2.35, status: '正常', limit: '≤5.00' },
  { indicator: '重金属 (Cr6+) (mg/L)', value: 0.006, status: '正常', limit: '≤0.05' },
];

const mockWarningData = [
  { time: '2024-07-18 09:47:12', company: '重庆 BB 电镀有限公司', outlet: '排污口 1', indicator: 'COD', value: '42.6 mg/L (超上限)', cdc: 0.91, level: '高风险', status: '未处理' },
  { time: '2024-07-18 09:32:45', company: '重庆 DD 印染有限公司', outlet: '排污口 2', indicator: '氨氮', value: '1.68 mg/L (超预警)', cdc: 0.87, level: '高风险', status: '未处理' },
  { time: '2024-07-18 08:54:21', company: '重庆 YY 化工有限公司', outlet: '排污口 1', indicator: 'pH', value: '9.35 (超上限)', cdc: 0.76, level: '中风险', status: '处理中' },
];

export default function AdminMonitoringPage() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900">实时监测（预警中心）</h1>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Activity className="h-4 w-4" />
              <span>数据更新时间：2024-07-18 10:25:30</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* 时间范围选择器 */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <Button
                variant={selectedTimeRange === '24h' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTimeRange('24h')}
                className={cn(
                  'h-8 px-3 text-sm',
                  selectedTimeRange === '24h' ? 'bg-sky-500 text-white' : ''
                )}
              >
                近 24 小时
              </Button>
              <Button
                variant={selectedTimeRange === '7d' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTimeRange('7d')}
                className={cn(
                  'h-8 px-3 text-sm',
                  selectedTimeRange === '7d' ? 'bg-sky-500 text-white' : ''
                )}
              >
                近 7 天
              </Button>
              <Button
                variant={selectedTimeRange === '30d' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTimeRange('30d')}
                className={cn(
                  'h-8 px-3 text-sm',
                  selectedTimeRange === '30d' ? 'bg-sky-500 text-white' : ''
                )}
              >
                近 30 天
              </Button>
            </div>
            <Button variant="outline" size="sm" className="h-8">
              2024-07-17 ~ 2024-07-18
            </Button>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧：CDC 风险排行 */}
          <div className="col-span-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    CDC 风险排行（实时）
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mockRankingData.map((item) => (
                    <div
                      key={item.rank}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 hover:border-sky-200 hover:bg-sky-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                          item.rank <= 3 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                        )}>
                          {item.rank}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">{item.cdc}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            item.riskColor === 'red' && 'border-red-200 bg-red-50 text-red-700',
                            item.riskColor === 'orange' && 'border-amber-200 bg-amber-50 text-amber-700',
                            item.riskColor === 'green' && 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          )}
                        >
                          {item.risk}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="w-full mt-4 text-sky-600 hover:text-sky-700 hover:bg-sky-50">
                  查看全部企业
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：企业详情 */}
          <div className="col-span-8 space-y-6">
            {/* 企业基本信息卡片 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-sky-500" />
                    企业详情：重庆 XX 科技有限公司
                  </CardTitle>
                  <Button variant="outline" size="sm">
                    切换企业
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-4">
                  <div className="text-center p-4 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100">
                    <div className="text-sm text-slate-600 mb-1">当前 CDC</div>
                    <div className="text-3xl font-bold text-orange-600">0.82</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-100">
                    <div className="text-sm text-slate-600 mb-1">风险等级</div>
                    <div className="text-lg font-bold text-amber-600">中风险</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-sm text-slate-600 mb-1">监测点数量</div>
                    <div className="text-2xl font-bold text-slate-900">2 <span className="text-sm text-emerald-600">↑</span></div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-sm text-slate-600 mb-1">排污口数量</div>
                    <div className="text-2xl font-bold text-slate-900">2 <span className="text-sm text-emerald-600">↑</span></div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-sm text-slate-600 mb-1">所属行业</div>
                    <div className="text-sm font-medium text-slate-900 mt-2">电子制造</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-sm text-slate-600 mb-1">负责人</div>
                    <div className="text-sm font-medium text-slate-900 mt-2">张三</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 实时监测数据 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    实时监测数据（最新）
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-sky-600 hover:text-sky-700">
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
                        <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">pH (无量纲)</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">COD (mg/L)</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">氨氮 (mg/L)</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">总磷 (mg/L)</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">总氮 (mg/L)</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">重金属 (Cr6+) (mg/L)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-3 px-4 text-sm font-medium text-slate-900">最新值</td>
                        <td className="text-center py-3 px-4 text-sm text-slate-900">7.32</td>
                        <td className="text-center py-3 px-4 text-sm text-slate-900">18.6</td>
                        <td className="text-center py-3 px-4 text-sm text-slate-900">1.12</td>
                        <td className="text-center py-3 px-4 text-sm text-slate-900">0.23</td>
                        <td className="text-center py-3 px-4 text-sm text-slate-900">2.35</td>
                        <td className="text-center py-3 px-4 text-sm text-slate-900">0.006</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-sm font-medium text-slate-900">状态</td>
                        <td className="text-center py-3 px-4">
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">正常</Badge>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">正常</Badge>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">正常</Badge>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">正常</Badge>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">正常</Badge>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">正常</Badge>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* 指标趋势 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    指标趋势（近 24 小时）
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-sky-600 hover:text-sky-700">
                    查看全部趋势
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  {['pH (无量纲)', 'COD (mg/L)', '氨氮 (mg/L)', '总磷 (mg/L)'].map((indicator) => (
                    <div key={indicator} className="border border-slate-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-slate-900 mb-3">{indicator}</div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                          <span className="text-xs text-slate-500">排污口 1</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                          <span className="text-xs text-slate-500">排污口 2</span>
                        </div>
                      </div>
                      {/* 模拟图表区域 */}
                      <div className="h-32 bg-slate-50 rounded flex items-center justify-center">
                        <div className="text-xs text-slate-400">图表区域</div>
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-slate-500">
                        <span>10:00</span>
                        <span>16:00</span>
                        <span>22:00</span>
                        <span>10:00</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 最新预警记录 */}
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                最新预警记录
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-sky-600 hover:text-sky-700">
                查看全部预警记录
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">预警时间</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">企业名称</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">排污口</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">预警指标</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">预警值</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">CDC</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">预警级别</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {mockWarningData.map((item, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-600">{item.time}</td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-900">{item.company}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{item.outlet}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{item.indicator}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{item.value}</td>
                      <td className="text-center py-3 px-4 text-sm font-semibold text-slate-900">{item.cdc}</td>
                      <td className="text-center py-3 px-4">
                        <Badge
                          className={cn(
                            'text-xs',
                            item.level === '高风险' && 'bg-red-100 text-red-700 border-red-200',
                            item.level === '中风险' && 'bg-amber-100 text-amber-700 border-amber-200'
                          )}
                        >
                          {item.level}
                        </Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge
                          className={cn(
                            'text-xs',
                            item.status === '未处理' && 'bg-slate-100 text-slate-700 border-slate-200',
                            item.status === '处理中' && 'bg-blue-100 text-blue-700 border-blue-200'
                          )}
                        >
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
