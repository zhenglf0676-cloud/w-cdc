'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  Search,
  Plus,
  MapPin,
  Building2,
  Droplets,
  CheckCircle,
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

interface DischargeOutlet {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason?: string;
  created_at: string;
}

const POLLUTANT_OPTIONS = [
  { id: 'cod', label: 'COD（化学需氧量）', default: true, custom: false },
  { id: 'nh3n', label: 'NH₃-N（氨氮）', default: true, custom: false },
  { id: 'tp', label: 'TP（总磷）', default: true, custom: false },
  { id: 'tn', label: 'TN（总氮）', default: false, custom: false },
  { id: 'ph', label: 'pH（酸碱度）', default: false, custom: false },
  { id: 'heavy_metal', label: '重金属', default: false, custom: true },
  { id: 'other', label: '其他', default: false, custom: true },
];

export default function EnterpriseHome() {
  const router = useRouter();
  const { user, session, isLoading } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [selectedPollutants, setSelectedPollutants] = useState<string[]>(
    POLLUTANT_OPTIONS.filter((p) => p.default).map((p) => p.id)
  );
  const [customHeavyMetals, setCustomHeavyMetals] = useState<string[]>([]);
  const [customOthers, setCustomOthers] = useState<string[]>([]);
  const [heavyMetalInput, setHeavyMetalInput] = useState('');
  const [otherInput, setOtherInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  // 排污口相关状态
  const [dischargeOutlets, setDischargeOutlets] = useState<DischargeOutlet[]>([]);
  const [outletName, setOutletName] = useState('');
  const [selectedOutletLocation, setSelectedOutletLocation] = useState<{ lat: number; lng: number } | null>(null);
  const outletMarkerRef = useRef<any>(null);
  const [submittingOutlet, setSubmittingOutlet] = useState(false);
  const [outletSuccess, setOutletSuccess] = useState(false);
  const [outletError, setOutletError] = useState('');

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

  // 获取园区企业数据和用户位置
  useEffect(() => {
    if (!session) return;
    const fetchData = async () => {
      try {
        // 获取用户位置
        const profileRes = await fetch('/api/profiles/me', {
          headers: { 'x-session': session.access_token },
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.success && profileData.data.latitude && profileData.data.longitude) {
            setUserLocation({
              lat: profileData.data.latitude,
              lng: profileData.data.longitude,
            });
          }
        }

        // 获取园区企业
        const res = await fetch('/api/admin/park-enterprises', {
          headers: { 'x-session': session.access_token },
        });
        if (res.ok) {
          const data = await res.json();
          setEnterprises(data.enterprises || []);
        }

        // 获取本企业的排污口列表
        const outletsRes = await fetch('/api/enterprise/discharge-outlets', {
          headers: { 'x-session': session.access_token },
        });
        if (outletsRes.ok) {
          const outletsData = await outletsRes.json();
          if (outletsData.success) {
            setDischargeOutlets(outletsData.data || []);
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
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

      // 使用用户位置作为地图中心，如果没有则使用默认位置
      const center = userLocation
        ? [userLocation.lng, userLocation.lat]
        : [106.32409, 29.591176];

      const map = new AMap.Map(mapContainerRef.current!, {
        zoom: 16,
        center: center,
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

      // 添加已审批通过的排污口标记
      dischargeOutlets
        .filter((outlet) => outlet.status === 'approved')
        .forEach((outlet) => {
          const marker = new AMap.Marker({
            position: [outlet.longitude, outlet.latitude],
            title: outlet.name,
            label: {
              content: `<div class="outlet-label" style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${outlet.name}</div>`,
              direction: 'top',
            },
          });
          map.add(marker);
        });

      // 添加地图点击事件，用于选择排污口位置
      map.on('click', (e: any) => {
        const lnglat = e.lnglat;
        const lng = lnglat.getLng();
        const lat = lnglat.getLat();
        
        // 移除旧的标记
        if (outletMarkerRef.current) {
          map.remove(outletMarkerRef.current);
        }
        
        // 添加新标记
        const newMarker = new AMap.Marker({
          position: [lng, lat],
          content: '<div style="background: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
          offset: new AMap.Pixel(-6, -6),
        });
        map.add(newMarker);
        outletMarkerRef.current = newMarker;
        setSelectedOutletLocation({ lat, lng });
      });
    };

    initMap().catch(console.error);
  }, [enterprises, userLocation, dischargeOutlets]);

  const togglePollutant = (id: string) => {
    setSelectedPollutants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const addCustomPollutant = (type: 'heavy_metal' | 'other', value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (type === 'heavy_metal') {
      if (customHeavyMetals.includes(trimmed)) {
        return;
      }
      setCustomHeavyMetals((prev) => [...prev, trimmed]);
      setHeavyMetalInput('');
    } else {
      if (customOthers.includes(trimmed)) {
        return;
      }
      setCustomOthers((prev) => [...prev, trimmed]);
      setOtherInput('');
    }
  };

  const removeCustomPollutant = (type: 'heavy_metal' | 'other', value: string) => {
    if (type === 'heavy_metal') {
      setCustomHeavyMetals((prev) => prev.filter((p) => p !== value));
    } else {
      setCustomOthers((prev) => prev.filter((p) => p !== value));
    }
  };

  const handleSubmitPollutants = async () => {
    if (selectedPollutants.length === 0) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const pollutants = POLLUTANT_OPTIONS.filter(
        (p) => selectedPollutants.includes(p.id) && !p.custom
      ).map((p) => ({
        id: p.id,
        label: p.label,
      }));

      customHeavyMetals.forEach((metal) => {
        pollutants.push({ id: `heavy_metal_${metal}`, label: metal });
      });

      customOthers.forEach((other) => {
        pollutants.push({ id: `other_${other}`, label: other });
      });

      const res = await fetch('/api/enterprise/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session': session?.access_token || '',
        },
        body: JSON.stringify({ pollutants }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.error || '提交失败');
        setTimeout(() => setSubmitError(''), 5000);
        throw new Error(data.error || '提交失败');
      }

      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (error) {
      console.error('提交申请失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const isHeavyMetalSelected = selectedPollutants.includes('heavy_metal');
  const isOtherSelected = selectedPollutants.includes('other');

  const handleSubmitOutlet = async () => {
    if (!outletName.trim() || !selectedOutletLocation) {
      setOutletError('请先在地图上选择位置并填写排污口名称');
      setTimeout(() => setOutletError(''), 3000);
      return;
    }

    setSubmittingOutlet(true);
    setOutletError('');

    try {
      const res = await fetch('/api/enterprise/discharge-outlets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session': session?.access_token || '',
        },
        body: JSON.stringify({
          name: outletName.trim(),
          latitude: selectedOutletLocation.lat,
          longitude: selectedOutletLocation.lng,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setOutletError(data.error || '提交失败');
        setTimeout(() => setOutletError(''), 5000);
        throw new Error(data.error || '提交失败');
      }

      setOutletSuccess(true);
      setOutletName('');
      setSelectedOutletLocation(null);
      
      // 移除标记
      if (outletMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.remove(outletMarkerRef.current);
        outletMarkerRef.current = null;
      }

      // 刷新排污口列表
      const outletsRes = await fetch('/api/enterprise/discharge-outlets', {
        headers: { 'x-session': session?.access_token || '' },
      });
      if (outletsRes.ok) {
        const outletsData = await outletsRes.json();
        if (outletsData.success) {
          setDischargeOutlets(outletsData.data || []);
        }
      }

      setTimeout(() => setOutletSuccess(false), 3000);
    } catch (error) {
      console.error('提交排污口申请失败:', error);
    } finally {
      setSubmittingOutlet(false);
    }
  };

  if (isLoading || redirecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!user) return null;

  const companyName = user.user_metadata?.company_name || user.user_metadata?.full_name || '企业用户';

  return (
    <div className="p-6">
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
                <div key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedPollutants.includes(p.id)}
                      onChange={() => togglePollutant(p.id)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>{p.label}</span>
                  </label>
                  {/* 重金属输入框 */}
                  {p.id === 'heavy_metal' && isHeavyMetalSelected && (
                    <div className="ml-6 mt-1 space-y-1">
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={heavyMetalInput}
                          onChange={(e) => setHeavyMetalInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomPollutant('heavy_metal', heavyMetalInput);
                            }
                          }}
                          placeholder="输入重金属名称（如 Cr⁶、Pb）"
                          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:border-sky-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => addCustomPollutant('heavy_metal', heavyMetalInput)}
                          className="rounded bg-sky-100 px-2 py-1 text-xs text-sky-700 hover:bg-sky-200"
                        >
                          添加
                        </button>
                      </div>
                      {customHeavyMetals.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {customHeavyMetals.map((item) => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-700"
                            >
                              {item}
                              <button
                                type="button"
                                onClick={() => removeCustomPollutant('heavy_metal', item)}
                                className="text-sky-400 hover:text-sky-600"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* 其他输入框 */}
                  {p.id === 'other' && isOtherSelected && (
                    <div className="ml-6 mt-1 space-y-1">
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={otherInput}
                          onChange={(e) => setOtherInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomPollutant('other', otherInput);
                            }
                          }}
                          placeholder="输入污染物名称"
                          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:border-sky-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => addCustomPollutant('other', otherInput)}
                          className="rounded bg-sky-100 px-2 py-1 text-xs text-sky-700 hover:bg-sky-200"
                        >
                          添加
                        </button>
                      </div>
                      {customOthers.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {customOthers.map((item) => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-700"
                            >
                              {item}
                              <button
                                type="button"
                                onClick={() => removeCustomPollutant('other', item)}
                                className="text-sky-400 hover:text-sky-600"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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

            {/* 错误提示 */}
            {submitError && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
          </div>

          {/* Apply Discharge Outlet */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
                <MapPin className="h-4 w-4 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-900">申请排污口</h3>
            </div>
            <p className="mb-3 text-xs text-slate-500">在地图上点击选择位置，填写名称提交审批</p>

            <div className="space-y-3">
              {/* 选中的位置 */}
              <div className="rounded-md bg-slate-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-sky-600" />
                  <span className="text-xs font-medium text-slate-700">选中位置</span>
                </div>
                {selectedOutletLocation ? (
                  <div className="text-xs text-slate-600">
                    <p>经度: {selectedOutletLocation.lng.toFixed(6)}</p>
                    <p>纬度: {selectedOutletLocation.lat.toFixed(6)}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">请在地图上点击选择位置</p>
                )}
              </div>

              {/* 排污口名称 */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">排污口名称</label>
                <input
                  type="text"
                  value={outletName}
                  onChange={(e) => setOutletName(e.target.value)}
                  placeholder="请输入排污口名称"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <button
              onClick={handleSubmitOutlet}
              disabled={submittingOutlet || !outletName.trim() || !selectedOutletLocation}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {submittingOutlet ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : outletSuccess ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {outletSuccess ? '提交成功' : '提交排污口申请'}
            </button>

            {/* 错误提示 */}
            {outletError && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{outletError}</span>
              </div>
            )}

            {/* 排污口列表 */}
            {dischargeOutlets.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <h4 className="mb-2 text-xs font-semibold text-slate-700">我的排污口</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {dischargeOutlets.map((outlet) => (
                    <div key={outlet.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-xs text-slate-700">{outlet.name}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        outlet.status === 'approved' ? 'bg-green-100 text-green-700' :
                        outlet.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {outlet.status === 'approved' ? '已通过' :
                         outlet.status === 'pending' ? '待审批' : '已拒绝'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
