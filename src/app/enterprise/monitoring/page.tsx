'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import ReactECharts from 'echarts-for-react';
import {
  Search,
  MapPin,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
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

interface MonitoringRecord {
  id: string;
  pollutant_type: string;
  value: number;
  unit: string;
  standard_limit: number;
  status: 'normal' | 'warning';
  monitored_at: string;
}

export default function MonitoringPage() {
  const router = useRouter();
  const { user, session, isLoading } = useAuth();
  
  const [outlets, setOutlets] = useState<DischargeOutlet[]>([]);
  const [approvedPollutants, setApprovedPollutants] = useState<Pollutant[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<DischargeOutlet | null>(null);
  const [latestData, setLatestData] = useState<Record<string, MonitoringRecord>>({});
  const [historyData, setHistoryData] = useState<MonitoringRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  
  // 上传对话框状态
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadMode, setUploadMode] = useState<'manual' | 'excel'>('manual');
  const [uploadForm, setUploadForm] = useState({
    outletId: '',
    monitoredAt: '',
    values: {} as Record<string, string>,
    remark: '',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  // Excel 上传状态
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelResult, setExcelResult] = useState<{ success: boolean; count: number; errors: string[]; warnings: string[] } | null>(null);

  // 图表相关状态
  const [timeRange, setTimeRange] = useState<'today' | '7days'>('today');
  const [chartData, setChartData] = useState<MonitoringRecord[]>([]);

  const itemsPerPage = 5;
  const historyPageSize = 5;

  // 认证检查
  useEffect(() => {
    if (!isLoading && !user) {
      setRedirecting(true);
      router.push('/login');
      return;
    }
    if (!isLoading && user?.user_metadata?.role !== 'enterprise') {
      setRedirecting(true);
      router.push('/admin');
      return;
    }
  }, [user, isLoading, router]);

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

  // 获取实时监测数据
  const fetchRealtimeData = async (outletId: string) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/enterprise/monitoring/realtime?outletId=${outletId}`, {
        headers: { 'x-session': session.access_token },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLatestData(data.data || {});
        }
      }
    } catch (error) {
      console.error('获取实时数据失败:', error);
    }
  };

  useEffect(() => {
    if (!session || !selectedOutlet) return;
    fetchRealtimeData(selectedOutlet.id);
  }, [session, selectedOutlet]);

  // 获取历史监测数据（只显示当天）
  const fetchHistoryData = async (outletId: string) => {
    if (!session) return;
    try {
      const res = await fetch(
        `/api/enterprise/monitoring/history?outletId=${outletId}&days=1&page=1&pageSize=${historyPageSize}`,
        {
          headers: { 'x-session': session.access_token },
        }
      );
      if (res.ok) {
        const data = await res.json();
        console.log('监测记录 API 返回:', data);
        if (data.success) {
          setHistoryData(data.data || []);
        }
      }
    } catch (error) {
      console.error('获取历史数据失败:', error);
    }
  };

  useEffect(() => {
    if (!session || !selectedOutlet) return;
    fetchHistoryData(selectedOutlet.id);
  }, [session, selectedOutlet]);

  // 获取图表数据
  const fetchChartData = async (outletId: string, range: 'today' | '7days' = timeRange) => {
    if (!session) return;
    try {
      const days = range === 'today' ? 1 : 7;
      const res = await fetch(
        `/api/enterprise/monitoring/history?outletId=${outletId}&days=${days}&pageSize=1000`,
        {
          headers: { 'x-session': session.access_token },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setChartData(data.data || []);
        }
      }
    } catch (error) {
      console.error('获取图表数据失败:', error);
    }
  };

  useEffect(() => {
    if (!session || !selectedOutlet) return;
    fetchChartData(selectedOutlet.id, timeRange);
  }, [session, selectedOutlet, timeRange]);

  // 获取排污口列表
  const fetchOutlets = async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/enterprise/discharge-outlets', {
        headers: { 'x-session': session.access_token },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          console.log('获取到的排污口:', data.data);
          setOutlets(data.data || []);
        }
      }
    } catch (error) {
      console.error('获取排污口列表失败:', error);
    }
  };

  // 过滤排污口列表
  const filteredOutlets = outlets.filter(outlet =>
    outlet.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredOutlets.length / itemsPerPage);
  const paginatedOutlets = filteredOutlets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 打开上传对话框
  const handleOpenUpload = () => {
    if (!selectedOutlet) return;
    setUploadForm({
      outletId: selectedOutlet.id,
      monitoredAt: new Date().toISOString().slice(0, 16),
      values: {},
      remark: '',
    });
    setUploadSuccess(false);
    setUploadError('');
    setShowUploadDialog(true);
  };

  // 处理 Excel 上传
  const handleExcelUpload = async () => {
    if (!excelFile) {
      setExcelResult({ success: false, count: 0, errors: ['请选择文件'], warnings: [] });
      return;
    }

    if (!session) {
      setExcelResult({ success: false, count: 0, errors: ['未登录，请重新登录'], warnings: [] });
      return;
    }

    setExcelUploading(true);
    setExcelResult(null);

    console.log('=== 开始上传 Excel ===');
    console.log('文件名:', excelFile.name);
    console.log('文件大小:', excelFile.size, 'bytes');

    try {
      const formData = new FormData();
      formData.append('file', excelFile);

      console.log('发送请求...');
      
      const res = await fetch('/api/enterprise/monitoring/upload-excel', {
        method: 'POST',
        headers: {
          'x-session': session.access_token,
        },
        body: formData,
      });

      console.log('响应状态:', res.status, res.statusText);

      const text = await res.text();
      console.log('响应内容:', text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('服务器返回的不是 JSON 格式');
      }

      if (!res.ok) {
        setExcelResult({
          success: false,
          count: 0,
          errors: [data.error || `上传失败 (${res.status})`],
          warnings: [],
        });
        return;
      }

      setExcelResult(data);
      setExcelFile(null);

      // 刷新数据
      if (selectedOutlet) {
        fetchRealtimeData(selectedOutlet.id);
        fetchChartData(selectedOutlet.id, timeRange);
        fetchHistoryData(selectedOutlet.id);
      }
      fetchOutlets();
    } catch (error: any) {
      console.error('上传错误:', error);
      setExcelResult({
        success: false,
        count: 0,
        errors: [error.message || '上传失败'],
        warnings: [],
      });
    } finally {
      setExcelUploading(false);
    }
  };

  // 提交上传
  const handleUpload = async () => {
    if (!uploadForm.outletId || !uploadForm.monitoredAt) {
      setUploadError('请填写完整信息');
      return;
    }

    // 检查是否有至少一个污染物数值
    const hasValues = Object.values(uploadForm.values).some(v => v !== '');
    if (!hasValues) {
      setUploadError('请至少填写一个污染物数值');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const res = await fetch('/api/enterprise/monitoring/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session': session!.access_token,
        },
        body: JSON.stringify({
          outletId: uploadForm.outletId,
          monitoredAt: new Date(uploadForm.monitoredAt).toISOString(),
          values: Object.fromEntries(
            Object.entries(uploadForm.values)
              .filter(([_, v]) => v !== '')
              .map(([k, v]) => [k, parseFloat(v)])
          ),
          remark: uploadForm.remark,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUploadSuccess(true);
        setTimeout(() => {
          setShowUploadDialog(false);
          // 刷新数据
          window.location.reload();
        }, 1500);
      } else {
        setUploadError(data.error || '上传失败');
      }
    } catch (error) {
      setUploadError('上传失败');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || loading || redirecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!user) return null;

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

          <div className="overflow-y-auto" style={{ height: 'calc(100vh - 280px)' }}>
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

          {/* Upload Button */}
          <div className="border-t p-3">
            <button
              onClick={handleOpenUpload}
              disabled={!selectedOutlet}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              上传数据
            </button>
          </div>
        </div>

        {/* Right Panel - Data Display */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedOutlet ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedOutlet.name}</h2>
                  <p className="text-sm text-slate-500">
                    更新时间：{Object.values(latestData)[0]?.monitored_at 
                      ? new Date(Object.values(latestData)[0].monitored_at).toLocaleString('zh-CN')
                      : '暂无数据'}
                  </p>
                </div>
              </div>

              {/* Pollutant Cards */}
              {approvedPollutants.length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  {approvedPollutants.map((pollutant) => {
                    const record = latestData[pollutant.id];
                    const value = record?.value ?? 0;
                    const status = record?.status ?? 'normal';
                    
                    return (
                      <div
                        key={pollutant.id}
                        className="rounded-lg border bg-white p-4 shadow-sm"
                      >
                        <div className="mb-2 text-sm text-slate-600">
                          {pollutant.label}
                          <span className="ml-1 text-slate-400">({pollutant.unit})</span>
                        </div>
                        <div className="mb-2 flex items-baseline gap-1">
                          <span className="text-3xl font-semibold text-slate-900">
                            {value}
                          </span>
                          <span className="text-sm text-slate-400">/ {pollutant.threshold}</span>
                        </div>
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs ${
                            status === 'normal'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {status === 'normal' ? '正常' : '危险'}
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

              {/* 趋势图表 */}
              {approvedPollutants.length > 0 && chartData.length > 0 && (
                <div className="rounded-lg border bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b p-4">
                    <h3 className="font-semibold text-slate-900">监测趋势</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTimeRange('today')}
                        className={`rounded px-3 py-1 text-sm ${
                          timeRange === 'today'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        当天
                      </button>
                      <button
                        onClick={() => setTimeRange('7days')}
                        className={`rounded px-3 py-1 text-sm ${
                          timeRange === '7days'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        前七天
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <ChartOption
                      data={chartData}
                      pollutants={approvedPollutants}
                      timeRange={timeRange}
                    />
                  </div>
                </div>
              )}

              {/* Monitoring Records */}
              <div className="rounded-lg border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b p-4">
                  <h3 className="font-semibold text-slate-900">监测记录</h3>
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
                      {historyData.length === 0 ? (
                        <tr>
                          <td colSpan={approvedPollutants.length + 2} className="px-4 py-8 text-center text-slate-500">
                            暂无监测记录
                          </td>
                        </tr>
                      ) : (
                        // 按时间分组显示
                        Array.from(
                          historyData.reduce((map, record) => {
                            const time = record.monitored_at;
                            if (!map.has(time)) {
                              map.set(time, []);
                            }
                            map.get(time)!.push(record);
                            return map;
                          }, new Map<string, MonitoringRecord[]>())
                        ).map(([time, records]) => {
                          const hasWarning = records.some(r => r.status === 'warning');
                          return (
                            <tr key={time} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-600">
                                {new Date(time).toLocaleString('zh-CN')}
                              </td>
                              {approvedPollutants.map((p) => {
                                const record = records.find(r => r.pollutant_type === p.id);
                                return (
                                  <td key={p.id} className="px-4 py-3">
                                    {record ? record.value : '-'}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3">
                                <span className={`rounded px-2 py-0.5 text-xs ${
                                  hasWarning
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {hasWarning ? '危险' : '正常'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
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

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="text-lg font-semibold text-slate-900">上传监测数据</h3>
              <button
                onClick={() => {
                  setShowUploadDialog(false);
                  setUploadMode('manual');
                  setExcelFile(null);
                  setExcelResult(null);
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 上传模式切换 */}
            <div className="flex border-b">
              <button
                onClick={() => setUploadMode('manual')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  uploadMode === 'manual'
                    ? 'border-b-2 border-sky-500 text-sky-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                手动录入
              </button>
              <button
                onClick={() => setUploadMode('excel')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  uploadMode === 'excel'
                    ? 'border-b-2 border-sky-500 text-sky-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Excel 上传
              </button>
            </div>

            {uploadMode === 'manual' ? (
              <ManualUploadForm
                outlets={outlets}
                approvedPollutants={approvedPollutants}
                uploadForm={uploadForm}
                setUploadForm={setUploadForm}
                uploading={uploading}
                uploadSuccess={uploadSuccess}
                uploadError={uploadError}
                onUpload={handleUpload}
                onClose={() => setShowUploadDialog(false)}
              />
            ) : (
              <ExcelUploadForm
                outlets={outlets}
                excelFile={excelFile}
                setExcelFile={setExcelFile}
                excelUploading={excelUploading}
                excelResult={excelResult}
                onUpload={handleExcelUpload}
                onClose={() => setShowUploadDialog(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 图表组件
function ChartOption({
  data,
  pollutants,
  timeRange,
}: {
  data: MonitoringRecord[];
  pollutants: Pollutant[];
  timeRange: 'today' | '7days';
}) {
  // 按时间排序
  const sortedData = [...data].sort(
    (a, b) => new Date(a.monitored_at).getTime() - new Date(b.monitored_at).getTime()
  );

  // 提取时间点
  const times = Array.from(new Set(sortedData.map(d => d.monitored_at)));

  // 为每个污染物分配固定颜色
  const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];

  // 为每个污染物生成系列数据
  const series = pollutants.map((p, index) => {
    const pollutantData = sortedData.filter(d => d.pollutant_type === p.id);
    const dataMap = new Map(pollutantData.map(d => [d.monitored_at, d]));

    return {
      name: p.label,
      type: 'line' as const,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      data: times.map(t => {
        const record = dataMap.get(t);
        return record ? record.value : null;
      }),
      lineStyle: { width: 2 },
      itemStyle: {
        color: colors[index % colors.length],
      },
    };
  });

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'cross' as const },
    },
    legend: {
      data: pollutants.map(p => p.label),
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category' as const,
      boundaryGap: false,
      data: times.map(t => {
        const date = new Date(t);
        if (timeRange === 'today') {
          return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
      }),
    },
    yAxis: {
      type: 'value' as const,
      name: '数值',
    },
    series,
  }), [data, pollutants, timeRange, times, series]);

  return <ReactECharts option={option} style={{ height: '400px' }} notMerge lazyUpdate />;
}

// 手动录入表单组件
function ManualUploadForm({
  outlets,
  approvedPollutants,
  uploadForm,
  setUploadForm,
  uploading,
  uploadSuccess,
  uploadError,
  onUpload,
  onClose,
}: {
  outlets: DischargeOutlet[];
  approvedPollutants: Pollutant[];
  uploadForm: {
    outletId: string;
    monitoredAt: string;
    values: Record<string, string>;
    remark: string;
  };
  setUploadForm: React.Dispatch<React.SetStateAction<{
    outletId: string;
    monitoredAt: string;
    values: Record<string, string>;
    remark: string;
  }>>;
  uploading: boolean;
  uploadSuccess: boolean;
  uploadError: string;
  onUpload: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="p-4 space-y-4">
        {/* 排污口选择 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            排污口 <span className="text-red-500">*</span>
          </label>
          <select
            value={uploadForm.outletId}
            onChange={(e) => setUploadForm({ ...uploadForm, outletId: e.target.value })}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">请选择排污口</option>
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>
        </div>

        {/* 监测时间 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            监测时间 <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={uploadForm.monitoredAt}
            onChange={(e) => setUploadForm({ ...uploadForm, monitoredAt: e.target.value })}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        {/* 污染物数值 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            污染物数值（只填写有数据的项）
          </label>
          <div className="space-y-3 max-h-60 overflow-y-auto rounded-md border border-slate-200 p-3">
            {approvedPollutants.map((pollutant) => (
              <div key={pollutant.id}>
                <label className="mb-1 block text-xs text-slate-600">
                  {pollutant.label} ({pollutant.unit})
                  <span className="ml-2 text-slate-400">限值：{pollutant.threshold}</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={uploadForm.values[pollutant.id] || ''}
                  onChange={(e) => setUploadForm({
                    ...uploadForm,
                    values: { ...uploadForm.values, [pollutant.id]: e.target.value }
                  })}
                  placeholder="请输入数值"
                  className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 备注 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            备注（可选）
          </label>
          <input
            type="text"
            value={uploadForm.remark}
            onChange={(e) => setUploadForm({ ...uploadForm, remark: e.target.value })}
            placeholder="请输入备注"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        {/* 错误提示 */}
        {uploadError && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* 成功提示 */}
        {uploadSuccess && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>上传成功</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t p-4">
        <button
          onClick={onClose}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          取消
        </button>
        <button
          onClick={onUpload}
          disabled={uploading}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {uploading ? '上传中...' : '提交'}
        </button>
      </div>
    </>
  );
}

// Excel 上传表单组件
function ExcelUploadForm({
  outlets,
  excelFile,
  setExcelFile,
  excelUploading,
  excelResult,
  onUpload,
  onClose,
}: {
  outlets: DischargeOutlet[];
  excelFile: File | null;
  setExcelFile: React.Dispatch<React.SetStateAction<File | null>>;
  excelUploading: boolean;
  excelResult: { success: boolean; count: number; errors: string[]; warnings: string[] } | null;
  onUpload: () => void;
  onClose: () => void;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
    }
  };

  return (
    <>
      <div className="p-4 space-y-4">
        {/* 文件选择 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            选择 Excel 文件 <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-sky-700 hover:file:bg-sky-100"
          />
          {excelFile && (
            <p className="mt-2 text-xs text-slate-500">已选择：{excelFile.name}</p>
          )}
        </div>

        {/* 格式说明 */}
        <div className="rounded-md bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-700">Excel 格式要求：</p>
          <ul className="text-xs text-slate-600 space-y-1">
            <li>• 第一行必须是表头</li>
            <li>• 必需字段：排污口、时间</li>
            <li>• 污染物字段：COD、NH3-N、TP、TN、pH、重金属</li>
            <li>• 排污口名称必须与系统中已审批通过的排污口名称一致</li>
          </ul>
        </div>

        {/* 示例表格 */}
        <div className="rounded-md border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-1 text-left">排污口</th>
                <th className="px-2 py-1 text-left">时间</th>
                <th className="px-2 py-1 text-left">COD</th>
                <th className="px-2 py-1 text-left">NH3-N</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1 border-t">排污口 1</td>
                <td className="px-2 py-1 border-t">2024-07-18 10:30</td>
                <td className="px-2 py-1 border-t">18.6</td>
                <td className="px-2 py-1 border-t">0.32</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 错误提示 */}
        {excelResult?.errors && excelResult.errors.length > 0 && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="mb-1 text-sm font-medium text-red-700">上传失败：</p>
            <ul className="text-xs text-red-600 space-y-1">
              {excelResult.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 成功提示 */}
        {excelResult?.success && (
          <div className="rounded-md bg-green-50 border border-green-200 p-3">
            <p className="text-sm font-medium text-green-700">上传成功</p>
            <p className="text-xs text-green-600 mt-1">成功插入 {excelResult.count} 条记录</p>
            {excelResult.warnings.length > 0 && (
              <p className="text-xs text-amber-600 mt-1">预警污染物：{excelResult.warnings.join(', ')}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t p-4">
        <button
          onClick={onClose}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          取消
        </button>
        <button
          onClick={onUpload}
          disabled={excelUploading || !excelFile}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {excelUploading ? '上传中...' : '上传'}
        </button>
      </div>
    </>
  );
}
