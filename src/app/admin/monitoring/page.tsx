'use client';

import { useState, useEffect } from 'react';
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
import { useAuth } from '@/lib/auth-context';

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
  warningTime: string;
  enterpriseName: string;
  outletName: string;
  indicatorName: string;
  measuredValue: number;
  thresholdValue: number;
  thresholdType: string;
  cdcValue: number;
  riskLevel: string;
  status: string;
}

export default function AdminMonitoringPage() {
  const { session, isLoading } = useAuth();
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [rankingData, setRankingData] = useState<RankingData[]>([]);
  const [warningData, setWarningData] = useState<WarningData[]>([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');

  // 获取 CDC 排行数据
  const fetchRankingData = async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/admin/monitoring/ranking', {
        headers: {
          'x-auth-token': session.access_token
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setRankingData(result.data);
          setLastUpdateTime(new Date().toLocaleString('zh-CN'));
          // 默认选中第一个企业
          if (result.data.length > 0 && !selectedEnterprise) {
            setSelectedEnterprise(result.data[0]);
          }
        }
      }
    } catch (error) {
      console.error('获取 CDC 排行数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取预警记录
  const fetchWarningData = async () => {
    if (!session?.access_token) return;
    
    try {
      const response = await fetch('/api/admin/monitoring/warnings', {
        headers: {
          'x-auth-token': session.access_token
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setWarningData(result.data);
        }
      }
    } catch (error) {
      console.error('获取预警记录失败:', error);
    }
  };

  // 初始化数据
  useEffect(() => {
    if (!isLoading && session?.access_token) {
      fetchRankingData();
      fetchWarningData();
    }
  }, [isLoading, session]);

  // 刷新数据
  const handleRefresh = () => {
    fetchRankingData();
    fetchWarningData();
  };

  // 点击企业
  const handleEnterpriseClick = (enterprise: RankingData) => {
    setSelectedEnterprise(enterprise);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900">实时监测（预警中心）</h1>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Activity className="h-4 w-4" />
              <span>数据更新时间：{lastUpdateTime || '加载中...'}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
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
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={handleRefresh}
                    disabled={loading}
                  >
                    <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rankingData.map((item, index) => (
                    <div
                      key={item.enterpriseId}
                      onClick={() => handleEnterpriseClick(item)}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-3 transition-colors cursor-pointer',
                        selectedEnterprise?.enterpriseId === item.enterpriseId
                          ? 'border-sky-300 bg-sky-50'
                          : 'border-slate-100 bg-white hover:border-sky-200 hover:bg-sky-50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                          index < 3 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                        )}>
                          {index + 1}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{item.enterpriseName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">{item.overallCDC.toFixed(2)}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            item.riskColor === 'red' && 'border-red-200 bg-red-50 text-red-700',
                            item.riskColor === 'orange' && 'border-amber-200 bg-amber-50 text-amber-700',
                            item.riskColor === 'green' && 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          )}
                        >
                          {item.riskLevel}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {rankingData.length === 0 && !loading && (
                  <div className="text-center py-8 text-sm text-slate-500">
                    暂无数据
                  </div>
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
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-sky-500" />
                        企业详情：{selectedEnterprise.enterpriseName}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-6 gap-4">
                      <div className={cn(
                        'text-center p-4 rounded-lg border',
                        selectedEnterprise.riskColor === 'red' && 'bg-gradient-to-br from-red-50 to-rose-50 border-red-100',
                        selectedEnterprise.riskColor === 'orange' && 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100',
                        selectedEnterprise.riskColor === 'green' && 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100'
                      )}>
                        <div className="text-sm text-slate-600 mb-1">当前 CDC</div>
                        <div className={cn(
                          'text-3xl font-bold',
                          selectedEnterprise.riskColor === 'red' && 'text-red-600',
                          selectedEnterprise.riskColor === 'orange' && 'text-orange-600',
                          selectedEnterprise.riskColor === 'green' && 'text-emerald-600'
                        )}>
                          {selectedEnterprise.overallCDC.toFixed(2)}
                        </div>
                      </div>
                      <div className={cn(
                        'text-center p-4 rounded-lg border',
                        selectedEnterprise.riskColor === 'red' && 'bg-red-50 border-red-100',
                        selectedEnterprise.riskColor === 'orange' && 'bg-amber-50 border-amber-100',
                        selectedEnterprise.riskColor === 'green' && 'bg-emerald-50 border-emerald-100'
                      )}>
                        <div className="text-sm text-slate-600 mb-1">风险等级</div>
                        <div className={cn(
                          'text-lg font-bold',
                          selectedEnterprise.riskColor === 'red' && 'text-red-600',
                          selectedEnterprise.riskColor === 'orange' && 'text-amber-600',
                          selectedEnterprise.riskColor === 'green' && 'text-emerald-600'
                        )}>
                          {selectedEnterprise.riskLevel}
                        </div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-sm text-slate-600 mb-1">监测点数量</div>
                        <div className="text-2xl font-bold text-slate-900">{selectedEnterprise.totalPollutants}</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-sm text-slate-600 mb-1">排污口数量</div>
                        <div className="text-2xl font-bold text-slate-900">{selectedEnterprise.totalOutlets}</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-sm text-slate-600 mb-1">所属行业</div>
                        <div className="text-sm font-medium text-slate-900 mt-2">{selectedEnterprise.industry || '-'}</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-sm text-slate-600 mb-1">负责人</div>
                        <div className="text-sm font-medium text-slate-900 mt-2">{selectedEnterprise.contactPerson || '-'}</div>
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
                    <div className="text-center py-8 text-sm text-slate-500">
                      待实现：调用 /api/enterprise/monitoring/history 获取数据
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
                    <div className="text-center py-8 text-sm text-slate-500">
                      待实现：调用 /api/enterprise/monitoring/chart 获取数据
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">请从左侧选择一个企业查看详情</p>
                </CardContent>
              </Card>
            )}
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
                  {warningData.map((item, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-600">{item.warningTime}</td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-900">{item.enterpriseName}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{item.outletName}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{item.indicatorName}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {item.measuredValue} {item.thresholdType === 'upper' ? '(超上限)' : '(超预警)'}
                      </td>
                      <td className="text-center py-3 px-4 text-sm font-semibold text-slate-900">{item.cdcValue.toFixed(2)}</td>
                      <td className="text-center py-3 px-4">
                        <Badge
                          className={cn(
                            'text-xs',
                            item.riskLevel === '高风险' && 'bg-red-100 text-red-700 border-red-200',
                            item.riskLevel === '中风险' && 'bg-amber-100 text-amber-700 border-amber-200',
                            item.riskLevel === '低风险' && 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          )}
                        >
                          {item.riskLevel}
                        </Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge
                          className={cn(
                            'text-xs',
                            item.status === '未处理' && 'bg-slate-100 text-slate-700 border-slate-200',
                            item.status === '处理中' && 'bg-blue-100 text-blue-700 border-blue-200',
                            item.status === '已处理' && 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          )}
                        >
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {warningData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-sm text-slate-500">
                        暂无预警记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
