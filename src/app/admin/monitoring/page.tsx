'use client';

import { useState } from 'react';
import {
  Droplets,
  Bell,
  ChevronDown,
  Search,
  Plus,
  MapPin,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';

// 模拟数据
const mockOutlets = [
  { id: 1, name: '排污口 1（总排口）', status: 'normal', online: true },
  { id: 2, name: '排污口 2（生产废水排口）', status: 'normal', online: true },
  { id: 3, name: '排污口 3（生活污水排口）', status: 'normal', online: true },
  { id: 4, name: '排污口 4（冷却水排口）', status: 'warning', online: true },
  { id: 5, name: '排污口 5（初期雨水排口）', status: 'normal', online: true },
  { id: 6, name: '排污口 6（事故应急排口）', status: 'offline', online: false },
];

const mockPollutants = [
  { name: 'pH', unit: '无量纲', value: 7.32, status: 'normal' },
  { name: 'COD', unit: 'mg/L', value: 18.6, status: 'normal' },
  { name: '氨氮', unit: 'mg/L', value: 1.12, status: 'normal' },
  { name: '总磷', unit: 'mg/L', value: 0.23, status: 'normal' },
  { name: '总氮', unit: 'mg/L', value: 2.35, status: 'normal' },
  { name: '重金属（Cr⁶⁺）', unit: 'mg/L', value: 0.006, status: 'normal' },
];

const mockRecords = [
  { time: '2024-07-18 10:25:00', outlet: '排污口 1', ph: 7.32, cod: 18.6, nh3: 1.12, tp: 0.23, tn: 2.35, cr: 0.006, status: 'normal' },
  { time: '2024-07-18 10:20:00', outlet: '排污口 1', ph: 7.28, cod: 18.2, nh3: 1.09, tp: 0.21, tn: 2.31, cr: 0.006, status: 'normal' },
  { time: '2024-07-18 10:15:00', outlet: '排污口 1', ph: 7.31, cod: 17.9, nh3: 1.07, tp: 0.22, tn: 2.29, cr: 0.006, status: 'normal' },
  { time: '2024-07-18 10:10:00', outlet: '排污口 1', ph: 7.29, cod: 18.4, nh3: 1.10, tp: 0.22, tn: 2.33, cr: 0.006, status: 'normal' },
  { time: '2024-07-18 10:05:00', outlet: '排污口 1', ph: 7.30, cod: 18.1, nh3: 1.08, tp: 0.21, tn: 2.30, cr: 0.006, status: 'normal' },
];

export default function AdminMonitoringPage() {
  const [selectedOutlet, setSelectedOutlet] = useState(mockOutlets[0]);
  const [activeTab, setActiveTab] = useState('realtime');
  const [timeRange, setTimeRange] = useState('1h');
  const [currentPage, setCurrentPage] = useState(1);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'warning': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'offline': return 'text-slate-400 bg-slate-50 border-slate-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal': return '正常';
      case 'warning': return '预警';
      case 'offline': return '离线';
      default: return '未知';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航栏 */}
      <header className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Droplets className="h-6 w-6 text-sky-400" />
            <span className="font-semibold text-lg">园区地下水环境监测管理平台</span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <button className="flex items-center gap-2 text-slate-300 hover:text-white">
            <span>重庆 XX 科技有限公司</span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative p-2 hover:bg-slate-800 rounded-lg">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-sky-500 rounded-full flex items-center justify-center text-sm font-medium">
              张
            </div>
            <span>张三</span>
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 左侧菜单 */}
        <aside className="w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-60px)]">
          <nav className="p-4 space-y-1">
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800">
              <span className="text-lg">🏠</span>
              <span>首页（污染物管理）</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sky-600 text-white">
              <span className="text-lg"></span>
              <span>排污点监测</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800">
              <span className="text-lg">📊</span>
              <span>CDC 分析</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800">
              <span className="text-lg">👤</span>
              <span>个人中心</span>
            </a>
          </nav>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 p-6">
          {/* 页面标题区 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">排污点监测</h1>
              <p className="text-slate-600 mt-1">实时监测各排污点水质数据，掌握排污情况</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-200 rounded-lg p-1">
                <button className="px-4 py-2 bg-sky-500 text-white rounded-md text-sm font-medium">
                  实时数据
                </button>
                <button className="px-4 py-2 text-slate-600 text-sm font-medium">
                  历史数据
                </button>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg">
                <span className="text-sm text-slate-600">2024-07-18 10:25:30</span>
                <button className="text-slate-400 hover:text-slate-600">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-6">
            {/* 左侧排污口列表 */}
            <div className="w-80 bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900">排污口列表</h2>
                <button className="flex items-center gap-1 px-3 py-1.5 bg-sky-500 text-white rounded-md text-sm hover:bg-sky-600">
                  <Plus className="h-4 w-4" />
                  新增申请
                </button>
              </div>

              <select className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm mb-3">
                <option>全部排污口</option>
              </select>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索排污口名称"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm"
                />
              </div>

              <div className="space-y-2">
                {mockOutlets.map((outlet) => (
                  <button
                    key={outlet.id}
                    onClick={() => setSelectedOutlet(outlet)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedOutlet.id === outlet.id
                        ? 'bg-sky-50 border-sky-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`h-2 w-2 rounded-full ${
                        outlet.status === 'normal' ? 'bg-emerald-500' :
                        outlet.status === 'warning' ? 'bg-amber-500' : 'bg-slate-400'
                      }`} />
                      <span className="text-sm font-medium text-slate-900">{outlet.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={getStatusColor(outlet.status).split(' ')[0]}>
                        {getStatusText(outlet.status)}
                      </span>
                      <span className={outlet.online ? 'text-emerald-600' : 'text-slate-400'}>
                        {outlet.online ? '在线' : '离线'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-slate-600">{currentPage} / 2</span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 右侧内容区 */}
            <div className="flex-1 space-y-6">
              {/* 排污口标题 */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{selectedOutlet.name}</h2>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedOutlet.status)}`}>
                      {getStatusText(selectedOutlet.status)}
                    </span>
                  </div>
                  <button className="flex items-center gap-1 px-3 py-1.5 border border-sky-200 text-sky-600 rounded-md text-sm hover:bg-sky-50">
                    <MapPin className="h-4 w-4" />
                    查看位置
                  </button>
                </div>
                <p className="text-sm text-slate-500">更新时间：2024-07-18 10:25:30</p>
              </div>

              {/* 污染物指标卡片 */}
              <div className="grid grid-cols-6 gap-4">
                {mockPollutants.map((pollutant, index) => (
                  <div key={index} className="bg-white rounded-lg border border-slate-200 p-4">
                    <div className="text-sm text-slate-600 mb-2">
                      {pollutant.name} <span className="text-slate-400">({pollutant.unit})</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mb-2">
                      {pollutant.value}
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(pollutant.status)}`}>
                      {getStatusText(pollutant.status)}
                    </span>
                  </div>
                ))}
              </div>

              {/* 图表区域 */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setActiveTab('realtime')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 ${
                        activeTab === 'realtime'
                          ? 'border-sky-500 text-sky-600'
                          : 'border-transparent text-slate-600'
                      }`}
                    >
                      实时趋势
                    </button>
                    <button
                      onClick={() => setActiveTab('pollutant')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 ${
                        activeTab === 'pollutant'
                          ? 'border-sky-500 text-sky-600'
                          : 'border-transparent text-slate-600'
                      }`}
                    >
                      污染物趋势
                    </button>
                    <button
                      onClick={() => setActiveTab('compare')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 ${
                        activeTab === 'compare'
                          ? 'border-sky-500 text-sky-600'
                          : 'border-transparent text-slate-600'
                      }`}
                    >
                      对比分析
                    </button>
                  </div>
                  <div className="flex bg-slate-100 rounded-lg p-1">
                    {['1h', '6h', '24h'].map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1 text-sm rounded-md ${
                          timeRange === range
                            ? 'bg-sky-500 text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        {range === '1h' ? '1 小时' : range === '6h' ? '6 小时' : '24 小时'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 图表占位 */}
                <div className="h-80 bg-slate-50 rounded-lg flex items-center justify-center">
                  <div className="text-center text-slate-400">
                    <p className="text-sm">图表区域</p>
                    <p className="text-xs mt-1">后续接入 ECharts 实现</p>
                  </div>
                </div>
              </div>

              {/* 监测记录表格 */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">监测记录</h3>
                  <button className="text-sm text-sky-600 hover:text-sky-700">
                    查看更多 →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-2 text-slate-600 font-medium">时间</th>
                        <th className="text-left py-3 px-2 text-slate-600 font-medium">排污口</th>
                        <th className="text-left py-3 px-2 text-slate-600 font-medium">pH</th>
                        <th className="text-left py-3 px-2 text-slate-600 font-medium">COD</th>
                        <th className="text-left py-3 px-2 text-slate-600 font-medium">氨氮</th>
                        <th className="text-left py-3 px-2 text-slate-600 font-medium">总磷</th>
                        <th className="text-left py-3 px-2 text-slate-600 font-medium">总氮</th>
                        <th className="text-left py-3 px-2 text-slate-600 font-medium">重金属</th>
                        <th className="text-left py-3 px-2 text-slate-600 font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockRecords.map((record, index) => (
                        <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-2 text-slate-600">{record.time}</td>
                          <td className="py-3 px-2 text-slate-900">{record.outlet}</td>
                          <td className="py-3 px-2 text-slate-900">{record.ph}</td>
                          <td className="py-3 px-2 text-slate-900">{record.cod}</td>
                          <td className="py-3 px-2 text-slate-900">{record.nh3}</td>
                          <td className="py-3 px-2 text-slate-900">{record.tp}</td>
                          <td className="py-3 px-2 text-slate-900">{record.tn}</td>
                          <td className="py-3 px-2 text-slate-900">{record.cr}</td>
                          <td className="py-3 px-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(record.status)}`}>
                              {getStatusText(record.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
