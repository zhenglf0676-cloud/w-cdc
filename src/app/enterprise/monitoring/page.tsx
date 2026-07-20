'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  Search,
  MapPin,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  Table,
} from 'lucide-react';

interface DischargeOutlet {
  id: string;
  name: string;
  status: string;
}

interface Pollutant {
  id: string;
  label: string;
  unit: string;
  threshold: number;
}

interface PollutantData {
  type: string;
  label: string;
  value: number;
  unit: string;
  standardLimit: number;
  status: 'normal' | 'warning';
}

interface HistoryRecord {
  time: string;
  [key: string]: number | string;
}

// Mock 数据
const MOCK_POLLUTANT_DATA: PollutantData[] = [
  { type: 'cod', label: 'COD（化学需氧量）', value: 18.6, unit: 'mg/L', standardLimit: 500, status: 'normal' },
  { type: 'nh3n', label: 'NH₃-N（氨氮）', value: 0.32, unit: 'mg/L', standardLimit: 0.5, status: 'normal' },
  { type: 'tp', label: 'TP（总磷）', value: 0.23, unit: 'mg/L', standardLimit: 1, status: 'normal' },
];

const MOCK_HISTORY_DATA: HistoryRecord[] = [
  { time: '2024-07-18 10:25:00', cod: 18.6, nh3n: 0.32, tp: 0.23, status: 'normal' },
  { time: '2024-07-18 10:20:00', cod: 18.2, nh3n: 0.31, tp: 0.21, status: 'normal' },
  { time: '2024-07-18 10:15:00', cod: 17.9, nh3n: 0.29, tp: 0.22, status: 'normal' },
  { time: '2024-07-18 10:10:00', cod: 18.4, nh3n: 0.30, tp: 0.22, status: 'normal' },
  { time: '2024-07-18 10:05:00', cod: 18.1, nh3n: 0.28, tp: 0.21, status: 'normal' },
];

export default function MonitoringPage() {
  const router = useRouter();
  const { user, session, isLoading } = useAuth();
  
  const [outlets, setOutlets] = useState<DischargeOutlet[]>([]);
  const [approvedPollutants, setApprovedPollutants] = useState<Pollutant[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<DischargeOutlet | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | '7days'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const itemsPerPage = 5;

  // 获取企业排污口和污染物数据
  useEffect(() => {
    if (!session) return;

    const fetchData = async () => {
      try {
        // 获取排污口列表
        const outletsRes = await fetch('/api/enterprise/discharge-outlets', {
          headers: { 'x-session': session.access_token },
        });
        if (outletsRes.ok) {
          const outletsData = await outletsRes.json();
          if (outletsData.success) {
            // 只显示已审批通过的排污口
            const approvedOutlets = (outletsData.data || []).filter(
              (o: DischargeOutlet) => o.status === 'approved'
            );
            setOutlets(approvedOutlets);
            if (approvedOutlets.length > 0) {
              setSelectedOutlet(approvedOutlets[0]);
            }
          }
        }

        // 获取审批通过的污染物
        const applicationsRes = await fetch('/api/enterprise/applications', {
          headers: { 'x-session': session.access_token },
        });
        if (applicationsRes.ok) {
          const applicationsData = await applicationsRes.json();
          const approvedApplications = (applicationsData.applications || []).filter(
            (app: any) => app.status === 'approved'
          );
          
          // 合并所有已审批的污染物
          const allPollutants: Pollutant[] = [];
          const pollutantIds = new Set<string>();
          
          approvedApplications.forEach((app: any) => {
            if (app.pollutants && Array.isArray(app.pollutants)) {
              app.pollutants.forEach((p: any) => {
                if (!pollutantIds.has(p.id)) {
                  pollutantIds.add(p.id);
                  allPollutants.push({
                    id: p.id,
                    label: p.label,
                    unit: p.unit,
                    threshold: p.threshold,
                  });
                }
              });
            }
          });
          
          setApprovedPollutants(allPollutants);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  // 过滤排污口列表
  const filteredOutlets = outlets.filter(outlet =>
    outlet.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredOutlets.length / itemsPerPage);
  const paginatedOutlets = filteredOutlets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (isLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (user.user_metadata?.role !== 'enterprise') {
    router.push('/admin');
    return null;
  }

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
              {paginatedOutlets.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  暂无排污口数据
                </div>
              ) : (
                paginatedOutlets.map((outlet) => (
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
                ))
              )}
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

              {/* Pollutant Cards */}
              {approvedPollutants.length > 0 ? (
                <div className="grid grid-cols-6 gap-4">
                  {approvedPollutants.map((pollutant) => {
                    // 查找对应的 mock 数据
                    const mockData = MOCK_POLLUTANT_DATA.find(p => p.type === pollutant.id);
                    const value = mockData?.value ?? 0;
                    const status = value > pollutant.threshold ? 'warning' : 'normal';
                    
                    return (
                      <div
                        key={pollutant.id}
                        className="rounded-lg border bg-white p-4 shadow-sm"
                      >
                        <div className="mb-2 text-xs text-slate-500">
                          {pollutant.label}
                          <span className="ml-1 text-slate-400">({pollutant.unit})</span>
                        </div>
                        <div className="mb-2 text-2xl font-semibold text-slate-900">
                          {value}
                        </div>
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs ${
                            status === 'normal'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {status === 'normal' ? '正常' : '预警'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border bg-white p-8 text-center text-slate-500">
                  暂无审批通过的污染物数据
                </div>
              )}

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

              {/* Monitoring Records */}
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
                        {approvedPollutants.map((p) => (
                          <th key={p.id} className="px-4 py-3 text-left font-medium text-slate-700">
                            {p.label} ({p.unit})
                          </th>
                        ))}
                        <th className="px-4 py-3 text-left font-medium text-slate-700">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {MOCK_HISTORY_DATA.map((record, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-600">{record.time}</td>
                          {approvedPollutants.map((p) => (
                            <td key={p.id} className="px-4 py-3">
                              {record[p.id] ?? '-'}
                            </td>
                          ))}
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
            <div className="flex h-full items-center justify-center text-slate-500">
              请从左侧选择一个排污口
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
