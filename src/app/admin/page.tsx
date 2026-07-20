'use client';

import { useEffect, useState, useRef } from 'react';
import { MapPin, Building2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface Enterprise {
  user_id: string;
  full_name: string;
  company_name: string;
  park_name: string;
  latitude: number;
  longitude: number;
  outlet_count?: number;
}

interface DischargeOutlet {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: 'pending' | 'approved' | 'rejected';
  user_id: string;
  company_name?: string;
}

export default function AdminHome() {
  const { session } = useAuth();
  const [parkName, setParkName] = useState('');
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [dischargeOutlets, setDischargeOutlets] = useState<DischargeOutlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const outletMarkersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!session) return;

    // 加载数据
    const fetchData = async () => {
      try {
        // 获取企业数据
        const enterprisesRes = await fetch('/api/admin/park-enterprises', {
          headers: {
            'x-session': session.access_token,
          },
        });
        const enterprisesData = await enterprisesRes.json();
        if (enterprisesData.success) {
          setParkName(enterprisesData.data.parkName);
          setEnterprises(enterprisesData.data.enterprises);
        } else {
          console.error('加载企业数据失败:', enterprisesData.error);
        }

        // 获取已审批通过的排污口
        const outletsRes = await fetch('/api/discharge-outlets/approved', {
          headers: {
            'x-session': session.access_token,
          },
        });
        const outletsData = await outletsRes.json();
        if (outletsData.success) {
          setDischargeOutlets(outletsData.data || []);
        }
      } catch (err) {
        console.error('请求失败:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  useEffect(() => {
    if (loading || enterprises.length === 0 || !mapRef.current) return;

    let mapInstance: any = null;

    // 动态加载高德地图
    import('@amap/amap-jsapi-loader')
      .then((AMapLoader) => {
        (window as any)._AMapSecurityConfig = {
          securityJsCode: '0ab574a1c887c61ecaa4af9250d8563d',
        };

        return AMapLoader.load({
          key: '7f34d9a440f2d86314844ab310e966fd',
          version: '2.0',
          plugins: [],
        });
      })
      .then((AMap: any) => {
        if (!mapRef.current) return;

        // 计算地图中心点
        const centerLng =
          enterprises.reduce((sum, e) => sum + e.longitude, 0) / enterprises.length;
        const centerLat =
          enterprises.reduce((sum, e) => sum + e.latitude, 0) / enterprises.length;

        mapInstance = new AMap.Map(mapRef.current, {
          zoom: 13,
          center: [centerLng, centerLat],
          mapStyle: 'amap://styles/normal',
        });
        mapInstanceRef.current = mapInstance;

        // 添加企业标记
        enterprises.forEach((enterprise) => {
          const marker = new AMap.Marker({
            position: [enterprise.longitude, enterprise.latitude],
            title: enterprise.company_name,
            label: {
              content: `<div class="enterprise-label">${enterprise.company_name}</div>`,
              direction: 'top',
            },
          });

          // 点击标记显示信息窗体
          marker.on('click', () => {
            const outletCount = dischargeOutlets.filter(o => o.user_id === enterprise.user_id && o.status === 'approved').length;
            const infoWindow = new AMap.InfoWindow({
              content: `
                <div class="info-window">
                  <h3>${enterprise.company_name}</h3>
                  <p>负责人：${enterprise.full_name}</p>
                  <p>所属园区：${enterprise.park_name}</p>
                  <p>排污口数量：${outletCount}</p>
                  <p>位置：${enterprise.latitude.toFixed(6)}, ${enterprise.longitude.toFixed(6)}</p>
                </div>
              `,
              offset: new AMap.Pixel(0, -30),
            });
            infoWindow.open(mapInstance, marker.getPosition());
          });

          mapInstance.add(marker);
        });
      })
      .catch((err) => {
        console.error('地图加载失败:', err);
        setMapError('地图加载失败，请刷新页面重试');
      });

    return () => {
      if (mapInstance) {
        mapInstance.destroy();
      }
    };
  }, [loading, enterprises]);

  // 当 dischargeOutlets 更新时，更新地图上的排污口标记
  useEffect(() => {
    const map = mapInstanceRef.current;
    const AMap = (window as any).AMap;
    if (!map || loading || !AMap) return;

    // 移除旧的排污口标记
    outletMarkersRef.current.forEach((marker) => map.remove(marker));
    outletMarkersRef.current = [];

    // 添加新的排污口标记
    const approvedOutlets = dischargeOutlets.filter(outlet => outlet.status === 'approved');
    const newMarkers = approvedOutlets.map((outlet) => {
      const marker = new AMap.Marker({
        position: [outlet.longitude, outlet.latitude],
        title: outlet.name,
        label: {
          content: `<div style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${outlet.name}</div>`,
          direction: 'top',
        },
      });

      // 点击标记显示信息窗体
      marker.on('click', () => {
        const enterprise = enterprises.find(e => e.user_id === outlet.user_id);
        const infoWindow = new AMap.InfoWindow({
          content: `
            <div class="info-window">
              <h3>${outlet.name}</h3>
              <p>所属企业：${enterprise?.company_name || '未知'}</p>
              <p>状态：已通过</p>
              <p>位置：${outlet.latitude.toFixed(6)}, ${outlet.longitude.toFixed(6)}</p>
            </div>
          `,
          offset: new AMap.Pixel(0, -30),
        });
        infoWindow.open(map, marker.getPosition());
      });

      map.add(marker);
      return marker;
    });
    outletMarkersRef.current = newMarkers;
  }, [dischargeOutlets, loading, enterprises]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0EA5E9] mx-auto mb-4"></div>
          <p className="text-[#64748B]">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-30">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[#0F172A]">{parkName || '园区地图'}</h1>
              <p className="text-sm text-[#64748B] mt-1">
                共 {enterprises.length} 家企业
              </p>
            </div>
          </div>
        </header>

        <div className="p-6">
          {mapError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-700">{mapError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                刷新页面
              </button>
            </div>
          ) : enterprises.length === 0 ? (
            <div className="bg-white rounded-lg border border-[#E2E8F0] p-12 text-center">
              <Building2 className="w-16 h-16 text-[#CBD5E1] mx-auto mb-4" />
              <h2 className="text-lg font-medium text-[#0F172A] mb-2">暂无企业</h2>
              <p className="text-[#64748B]">该园区还没有企业注册</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 地图区域 */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E2E8F0]">
                    <h2 className="font-medium text-[#0F172A]">园区地图</h2>
                  </div>
                  <div ref={mapRef} className="h-[600px] w-full" />
                </div>
              </div>

              {/* 企业列表 */}
              <div>
                <div className="bg-white rounded-lg border border-[#E2E8F0]">
                  <div className="px-4 py-3 border-b border-[#E2E8F0]">
                    <h2 className="font-medium text-[#0F172A]">企业列表</h2>
                  </div>
                  <div className="divide-y divide-[#E2E8F0]">
                    {enterprises.map((enterprise) => (
                      <div key={enterprise.user_id} className="p-4 hover:bg-[#F8FAFC]">
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-[#0EA5E9] mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-[#0F172A] truncate">
                              {enterprise.company_name}
                            </h3>
                            <p className="text-sm text-[#64748B] mt-1">
                              负责人：{enterprise.full_name}
                            </p>
                            <p className="text-sm text-[#64748B] mt-1">
                              排污口：<span className="text-[#0EA5E9] font-medium">{enterprise.outlet_count || 0}</span> 个
                            </p>
                            <p className="text-xs text-[#94A3B8] mt-1">
                              {enterprise.latitude.toFixed(6)}, {enterprise.longitude.toFixed(6)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 图例 */}
                <div className="bg-white rounded-lg border border-[#E2E8F0] mt-6 p-4">
                  <h3 className="font-medium text-[#0F172A] mb-3">图例</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-[#0EA5E9]" />
                      <span className="text-sm text-[#64748B]">企业位置</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-[#10b981] flex items-center justify-center">
                        <span className="text-white text-xs">●</span>
                      </div>
                      <span className="text-sm text-[#64748B]">排污口（已通过）</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
