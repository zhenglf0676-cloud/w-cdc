'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { EnterpriseSidebar } from '@/components/enterprise-sidebar';
import { useAuth } from '@/lib/auth-context';
import {
  Search,
  Plus,
  Minus,
  MapPin,
  Building2,
  Droplets,
  CheckCircle,
  ChevronRight,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';

interface Enterprise {
  id: string;
  full_name: string;
  company_name: string;
  latitude: number;
  longitude: number;
}

const POLLUTANT_OPTIONS = [
  { id: 'cod', label: 'COD（化学需氧量）', default: true },
  { id: 'nh3n', label: 'NH₃-N（氨氮）', default: true },
  { id: 'tp', label: 'TP（总磷）', default: true },
  { id: 'tn', label: 'TN（总氮）', default: false },
  { id: 'ph', label: 'pH（酸碱度）', default: false },
  { id: 'heavy_metal', label: '重金属（如 Cr⁶）', default: false },
  { id: 'other', label: '其他', default: false },
];

export default function EnterpriseHome() {
  const router = useRouter();
  const { user, session, isLoading } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedPollutants, setSelectedPollutants] = useState<string[]>(
    POLLUTANT_OPTIONS.filter((p) => p.default).map((p) => p.id)
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // 认证检查
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
    if (!isLoading && user?.user_metadata?.role !== 'enterprise') {
      router.push('/admin');
    }
  }, [user, isLoading, router]);

  // 获取园区企业数据
  useEffect(() => {
    if (!session) return;
    const fetchEnterprises = async () => {
      try {
        const res = await fetch('/api/admin/park-enterprises', {
          headers: { 'x-session': session.access_token },
        });
        if (res.ok) {
          const data = await res.json();
          setEnterprises(data.enterprises || []);
        }
      } catch (error) {
        console.error('Failed to fetch enterprises:', error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchEnterprises();
  }, [session]);

  // 初始化地图
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const AMapLoader = (await import('@amap/amap-jsapi-loader')).default;
      (window as any)._AMapSecurityConfig = {
        securityJsCode: '0ab574a1c887c61ecaa4af9250d8563d',
      };

      const AMap = await AMapLoader.load({
        key: '7f34d9a440f2d86314844ab310e966fd',
        version: '2.0',
        plugins: ['AMap.Scale', 'AMap.ToolBar'],
      });

      const map = new AMap.Map(mapContainerRef.current!, {
        zoom: 14,
        center: [106.32409, 29.591176],
        mapStyle: 'amap://styles/light',
      });

      map.addControl(new AMap.Scale());
      map.addControl(new AMap.ToolBar({ position: 'LT' }));

      mapInstanceRef.current = map;

      // 添加企业标记
      enterprises.forEach((ent) => {
        if (ent.latitude && ent.longitude) {
          const marker = new AMap.Marker({
            position: [ent.longitude, ent.latitude],
            title: ent.company_name || ent.full_name,
            label: {
              content: `<div class="enterprise-label">${ent.company_name || ent.full_name}</div>`,
              direction: 'top',
            },
          });
          map.add(marker);
        }
      });
    };

    initMap().catch(console.error);
  }, [enterprises]);

  const togglePollutant = (id: string) => {
    setSelectedPollutants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmitPollutants = async () => {
    if (selectedPollutants.length === 0) return;
    setSubmitting(true);
    // TODO: 后续实现提交逻辑
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitting(false);
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 3000);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!user) return null;

  const companyName = user.user_metadata?.company_name || user.user_metadata?.full_name || '企业用户';

  return (
    <div className="min-h-screen bg-slate-50">
      <EnterpriseSidebar activeItem="home" />

      {/* Main Content */}
      <div className="ml-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white px-6 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">首页（污染物管理）</h1>
            <p className="text-xs text-slate-500">管理企业污染物与排污口，实时掌握排污情况</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{companyName}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
              {companyName.charAt(0)}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex gap-4 p-4">
          {/* Map Area */}
          <div className="flex-1">
            <div className="relative rounded-lg border bg-white shadow-sm">
              {/* Search Bar */}
              <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 shadow-sm">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索企业或排污口名称"
                  className="w-48 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>

              {/* Map */}
              <div ref={mapContainerRef} className="h-[600px] w-full rounded-lg" />

              {/* Legend */}
              <div className="absolute bottom-4 left-4 rounded-lg border bg-white/95 p-3 shadow-sm backdrop-blur-sm">
                <h4 className="mb-2 text-xs font-semibold text-slate-700">图例</h4>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>企业</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplets className="h-3.5 w-3.5 text-green-600" />
                    <span>排污口</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-5 border-t-2 border-dashed border-blue-400" />
                    <span>园区边界</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="w-80 space-y-4">
            {/* Apply Pollutants */}
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900">申请污染物</h3>
              </div>
              <p className="mb-3 text-xs text-slate-500">选择企业拟排放的污染物，提交管理员审批</p>

              <div className="space-y-2">
                {POLLUTANT_OPTIONS.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPollutants.includes(p.id)}
                      onChange={() => togglePollutant(p.id)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>

              <button
                onClick={handleSubmitPollutants}
                disabled={submitting || selectedPollutants.length === 0}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : submitSuccess ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {submitSuccess ? '提交成功' : '提交申请'}
              </button>
            </div>

            {/* Apply Discharge Outlet */}
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
                  <MapPin className="h-4 w-4 text-green-600" />
                </div>
                <h3 className="font-semibold text-slate-900">申请排污口</h3>
              </div>
              <p className="mb-3 text-xs text-slate-500">在地图上选择位置，填写信息提交审批</p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-md bg-slate-50 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="text-xs text-slate-600">
                    <p className="font-medium">1. 在地图上点击选择位置</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-md bg-slate-50 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div className="text-xs text-slate-600">
                    <p className="font-medium">2. 自动获取经纬度坐标</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-md bg-slate-50 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="text-xs text-slate-600">
                    <p className="font-medium">3. 填写名称并提交申请</p>
                  </div>
                </div>
              </div>

              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-sky-300 bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100">
                <Plus className="h-4 w-4" />
                新增排污口申请
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
