'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  Search,
  MapPin,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  RefreshCw,
  TrendingUp,
  Table,
} from 'lucide-react';

interface DischargeOutlet {
  id: string;
  name: string;
}

interface PollutantData {
  type: string;
  label: string;
  value: number;
  unit: string;
  standardLimit: number;
  status: 'normal' | 'warning';
}

const POLLUTANT_CONFIG = [
  { type: 'ph', label: 'pH', unit: '无量纲', standardLimit: 9 },
  { type: 'cod', label: 'COD', unit: 'mg/L', standardLimit: 50 },
  { type: 'nh3n', label: '氨氮', unit: 'mg/L', standardLimit: 5 },
  { type: 'tp', label: '总磷', unit: 'mg/L', standardLimit: 0.5 },
  { type: 'tn', label: '总氮', unit: 'mg/L', standardLimit: 15 },
  { type: 'heavy_metal', label: '重金属 (Cr⁶⁺)', unit: 'mg/L', standardLimit: 0.05 },
];

// Mock 数据
const MOCK_OUTLETS: DischargeOutlet[] = [
  { id: '1', name: '排污口1（总排口）' },
  { id: '2', name: '排污口2（生产废水排口）' },
  { id: '3', name: '排污口3（生活污水排口）' },
  { id: '4', name: '排污口4（冷却水排口）' },
  { id: '5', name: '排污口5（初期雨水排口）' },
  { id: '6', name: '排污口6（事故应急排口）' },
];

const MOCK_POLLUTANT_DATA: PollutantData[] = [
  { type: 'ph', label: 'pH', value: 7.32, unit: '无量纲', standardLimit: 9, status: 'normal' },
  { type: 'cod', label: 'COD', value: 18.6, unit: 'mg/L', standardLimit: 50, status: 'normal' },
  { type: 'nh3n', label: '氨氮', value: 1.12, unit: 'mg/L', standardLimit: 5, status: 'normal' },
  { type: 'tp', label: '总磷', value: 0.23, unit: 'mg/L', standardLimit: 0.5, status: 'normal' },
  { type: 'tn', label: '总氮', value: 2.35, unit: 'mg/L', standardLimit: 15, status: 'normal' },
  { type: 'heavy_metal', label: '重金属 (Cr⁶⁺)', value: 0.006, unit: 'mg/L', standardLimit: 0.05, status: 'normal' },
];

const MOCK_HISTORY_DATA = [
  { time: '2024-07-18 10:25:00', ph: 7.32, cod: 18.6, nh3n: 1.12, tp: 0.23, tn: 2.35, heavy_metal: 0.006, status: 'normal' },
  { time: '2024-07-18 10:20:00', ph: 7.28, cod: 18.2, nh3n: 1.09, tp: 0.21, tn: 2.31, heavy_metal: 0.006, status: 'normal' },
  { time: '2024-07-18 10:15:00', ph: 7.31, cod: 17.9, nh3n: 1.07, tp: 0.22, tn: 2.29, heavy_metal: 0.006, status: 'normal' },
  { time: '2024-07-18 10:10:00', ph: 7.29, cod: 18.4, nh3n: 1.10, tp: 0.22, tn: 2.33, heavy_metal: 0.006, status: 'normal' },
  { time: '2024-07-18 10:05:00', ph: 7.30, cod: 18.1, nh3n: 1.08, tp: 0.21, tn: 2.30, heavy_metal: 0.006, status: 'normal' },
];

export default function MonitoringPage() {
  const router = useRouter();
  const { user, session, isLoading } = useAuth();
  
  const [selectedOutlet, setSelectedOutlet] = useState<DischargeOutlet | null>(MOCK_OUTLETS[0]);
  const [activeTab, setActiveTab] = useState<'realtime' | 'history'>('realtime');
  const [timeRange, setTimeRange] = useState<'today' | '7days'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [redirecting, setRedirecting] = useState(false);

  const itemsPerPage = 5;

  // 认证检查
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!user) {
    setRedirecting(true);
    router.push('/login');
    return null;
  }

  if (user.user_metadata?.role !== 'enterprise') {
    setRedirecting(true);
    router.push('/admin');
    return null;
  }

  if (redirecting) return null;

  // 过滤排污口列表
  const filteredOutlets = MOCK_OUTLETS.filter(outlet =>
    outlet.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredOutlets.length / itemsPerPage);
  const paginatedOutlets = filteredOutlets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const companyName = user.user_metadata?.company_name || user.user_metadata?.full_name || '企业用户';

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
            <h1 className="text-lg font-semibold text-slate-900">排污点监测</h1>
            <p className="text-xs text-slate-500">实时监测各排污点水质数据，掌握排污情况</p>
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
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Outlet List */}
        <div className="w-72 border-r bg-white">
          <div className="border-b p-4">
            <h3 className="mb-3 font-semibold text-slate-900">排污口列表</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索排污口名称"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="overflow-y-auto" style={{ height: 'calc(100vh - 200px)' }}>
            <div className="p-2">
              {paginatedOutlets.map((outlet) => (
                <button
                  key={outlet.id}
                  onClick={() => setSelectedOutlet(outlet)}
                  className={`w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedOutlet?.id === outlet.id
                      ? 'bg-sky-50 text-sky-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">{outlet.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t p-3">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-slate-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - Data Display */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedOutlet ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedOutlet.name}</h2>
                  <p className="text-sm text-slate-500">更新时间：2024-07-18 10:25:30</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    <MapPin className="mr-1 inline h-4 w-4" />
                    查看位置
                  </button>
                </div>
              </div>

              {/* Tab Switch */}
              <div className="flex items-center gap-4 border-b">
                <button
                  onClick={() => setActiveTab('realtime')}
                  className={`pb-3 text-sm font-medium transition-colors ${
                    activeTab === 'realtime'
                      ? 'border-b-2 border-sky-600 text-sky-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TrendingUp className="mr-1 inline h-4 w-4" />
                  实时数据
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`pb-3 text-sm font-medium transition-colors ${
                    activeTab === 'history'
                      ? 'border-b-2 border-sky-600 text-sky-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Table className="mr-1 inline h-4 w-4" />
                  历史数据
                </button>
              </div>

              {activeTab === 'realtime' ? (
                <div className="space-y-6">
                  {/* Pollutant Cards */}
                  <div className="grid grid-cols-6 gap-4">
                    {MOCK_POLLUTANT_DATA.map((pollutant) => (
                      <div
                        key={pollutant.type}
                        className="rounded-lg border bg-white p-4 shadow-sm"
                      >
                        <div className="mb-2 text-xs text-slate-500">
                          {pollutant.label}
                          <span className="ml-1 text-slate-400">({pollutant.unit})</span>
                        </div>
                        <div className="mb-2 text-2xl font-semibold text-slate-900">
                          {pollutant.value}
                        </div>
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs ${
                            pollutant.status === 'normal'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {pollutant.status === 'normal' ? '正常' : '预警'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Chart Placeholder */}
                  <div className="rounded-lg border bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">实时趋势</h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTimeRange('today')}
                          className={`rounded px-3 py-1 text-xs ${
                            timeRange === 'today'
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          当天
                        </button>
                        <button
                          onClick={() => setTimeRange('7days')}
                          className={`rounded px-3 py-1 text-xs ${
                            timeRange === '7days'
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          前七天
                        </button>
                      </div>
                    </div>
                    <div className="flex h-64 items-center justify-center rounded-md bg-slate-50 text-sm text-slate-500">
                      图表区域（后续集成 ECharts）
                    </div>
                  </div>

                  {/* Recent Records */}
                  <div className="rounded-lg border bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b p-4">
                      <h3 className="font-semibold text-slate-900">监测记录</h3>
                      <button className="text-sm text-sky-600 hover:text-sky-700">
                        查看更多 →
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-slate-700">时间</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-700">pH</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-700">COD (mg/L)</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-700">氨氮 (mg/L)</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-700">总磷 (mg/L)</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-700">总氮 (mg/L)</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-700">重金属 (mg/L)</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-700">状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {MOCK_HISTORY_DATA.map((record, index) => (
                            <tr key={index} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-600">{record.time}</td>
                              <td className="px-4 py-3">{record.ph}</td>
                              <td className="px-4 py-3">{record.cod}</td>
                              <td className="px-4 py-3">{record.nh3n}</td>
                              <td className="px-4 py-3">{record.tp}</td>
                              <td className="px-4 py-3">{record.tn}</td>
                              <td className="px-4 py-3">{record.heavy_metal}</td>
                              <td className="px-4 py-3">
                                <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                                  正常
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                /* History Tab */
                <div className="rounded-lg border bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b p-4">
                    <div className="flex items-center gap-4">
                      <h3 className="font-semibold text-slate-900">历史监测记录</h3>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <select className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none">
                          <option>2024-07-18</option>
                          <option>2024-07-17</option>
                          <option>2024-07-16</option>
                        </select>
                      </div>
                    </div>
                    <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <RefreshCw className="mr-1 inline h-4 w-4" />
                      刷新
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-slate-700">时间</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-700">pH</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-700">COD (mg/L)</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-700">氨氮 (mg/L)</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-700">总磷 (mg/L)</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-700">总氮 (mg/L)</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-700">重金属 (mg/L)</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-700">状态</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {MOCK_HISTORY_DATA.map((record, index) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-600">{record.time}</td>
                            <td className="px-4 py-3">{record.ph}</td>
                            <td className="px-4 py-3">{record.cod}</td>
                            <td className="px-4 py-3">{record.nh3n}</td>
                            <td className="px-4 py-3">{record.tp}</td>
                            <td className="px-4 py-3">{record.tn}</td>
                            <td className="px-4 py-3">{record.heavy_metal}</td>
                            <td className="px-4 py-3">
                              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                                正常
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t p-4">
                    <span className="text-sm text-slate-600">共 5 条记录</span>
                    <div className="flex items-center gap-2">
                      <button className="rounded border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">
                        上一页
                      </button>
                      <button className="rounded border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">
                        下一页
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              请从左侧选择一个排污口
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
