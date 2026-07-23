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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const enterpriseMarkersRef = useRef<any[]>([]);
  const outletMarkersRef = useRef<any[]>([]);
  const dischargeOutletsRef = useRef<DischargeOutlet[]>([]);

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
        console.log('企业数据API响应:', enterprisesData);
        if (enterprisesData.success) {
          setParkName(enterprisesData.data.parkName);
          setEnterprises(enterprisesData.data.enterprises);
          console.log('设置企业数据:', enterprisesData.data.enterprises.length, '家企业');
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
          const outlets = outletsData.data || [];
          console.log('获取到排污口数据:', outlets);
          setDischargeOutlets(outlets);
          dischargeOutletsRef.current = outlets;
        } else {
          console.error('获取排污口数据失败:', outletsData.error);
        }
      } catch (err) {
        console.error('请求失败:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  // Helper function to add markers to map
  const addMarkersToMap = () => {
    const AMap = (window as any).__AMap__ || (window as any).AMap;
    const map = mapRef.current;

    console.log('addMarkersToMap 调用:', {
      hasAMap: !!AMap,
      hasMap: !!map,
      enterpriseCount: enterprises.length,
      outletCount: dischargeOutletsRef.current.length,
    });

    if (!AMap || !map) return;

    // Clear old markers
    enterpriseMarkersRef.current.forEach((marker) => marker.setMap(null));
    outletMarkersRef.current.forEach((marker) => marker.setMap(null));

    // Add enterprise markers
    const newEnterpriseMarkers = enterprises.map((enterprise) => {
      const markerContent = document.createElement('div');
      markerContent.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        background: #3B82F6; border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: bold; font-size: 14px;
      `;
      markerContent.innerHTML = '<span>企</span>';

      const marker = new AMap.Marker({
        position: new AMap.LngLat(enterprise.longitude, enterprise.latitude),
        content: markerContent,
        offset: new AMap.Pixel(-16, -16),
      });

      const outletCount = enterprise.outlet_count || 0;

      marker.on('click', () => {
        const infoWindow = new AMap.InfoWindow({
          content: `
            <div style="padding:10px;min-width:200px;font-family:'Noto Sans SC',sans-serif;">
              <div style="font-weight:600;font-size:14px;margin-bottom:6px;">${enterprise.company_name}</div>
              <div style="font-size:12px;color:#64748B;margin-bottom:4px;">负责人：${enterprise.full_name}</div>
              <div style="font-size:12px;color:#64748B;margin-bottom:4px;">所属园区：${enterprise.park_name}</div>
              <div style="font-size:12px;margin-bottom:4px;">排污口数量：<span style="color:#3B82F6;font-weight:500;">${outletCount}</span> 个</div>
              <div style="font-size:12px;color:#94A3B8;">位置：${enterprise.latitude.toFixed(6)}, ${enterprise.longitude.toFixed(6)}</div>
            </div>
          `,
          offset: new AMap.Pixel(0, -30),
        });
        infoWindow.open(map, marker.getPosition());
      });

      map.add(marker);
      return marker;
    });

    enterpriseMarkersRef.current = newEnterpriseMarkers;

    // Add discharge outlet markers
    const newOutletMarkers = dischargeOutletsRef.current.map((outlet) => {
      const markerContent = document.createElement('div');
      markerContent.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        background: #10B981; border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: bold; font-size: 12px;
      `;
      markerContent.innerHTML = '<span>排</span>';

      const marker = new AMap.Marker({
        position: new AMap.LngLat(outlet.longitude, outlet.latitude),
        content: markerContent,
        offset: new AMap.Pixel(-14, -14),
      });

      marker.on('click', () => {
        const enterprise = enterprises.find(e => e.user_id === outlet.user_id);
        const infoWindow = new AMap.InfoWindow({
          content: `
            <div style="padding:10px;min-width:180px;font-family:'Noto Sans SC',sans-serif;">
              <div style="font-weight:600;font-size:14px;margin-bottom:6px;">${outlet.name}</div>
              <div style="font-size:12px;color:#64748B;margin-bottom:4px;">所属企业：${enterprise?.company_name || '未知'}</div>
              <div style="font-size:12px;">状态：<span style="color:#10B981;font-weight:500;">已通过</span></div>
              <div style="font-size:12px;color:#94A3B8;margin-top:4px;">位置：${outlet.latitude.toFixed(6)}, ${outlet.longitude.toFixed(6)}</div>
            </div>
          `,
          offset: new AMap.Pixel(0, -30),
        });
        infoWindow.open(map, marker.getPosition());
      });

      map.add(marker);
      return marker;
    });

    outletMarkersRef.current = newOutletMarkers;

    // Center map on first enterprise
    if (enterprises.length > 0) {
      const firstEnterprise = enterprises[0];
      map.setCenter([firstEnterprise.longitude, firstEnterprise.latitude]);
    }
  };

  // Initialize map
  useEffect(() => {
    console.log('地图初始化检查:', { loading, enterpriseCount: enterprises.length, hasContainer: !!mapContainerRef.current });
    if (loading || enterprises.length === 0 || !mapContainerRef.current) {
      console.log('地图初始化条件不满足，跳过');
      return;
    }

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
        if (!mapContainerRef.current) return;

        // 销毁已存在的地图实例
        if (mapRef.current) {
          mapRef.current.destroy();
          mapRef.current = null;
        }

        // 计算地图中心点
        const centerLng = enterprises.reduce((sum, e) => sum + e.longitude, 0) / enterprises.length;
        const centerLat = enterprises.reduce((sum, e) => sum + e.latitude, 0) / enterprises.length;

        // 创建新的地图实例
        mapInstance = new AMap.Map(mapContainerRef.current, {
          zoom: 13,
          center: [centerLng, centerLat],
          mapStyle: 'amap://styles/normal',
        });
        mapRef.current = mapInstance;

        // 存储 AMap 引用用于标记更新
        (window as any).__AMap__ = AMap;

        // 初始化完成后添加标记
        setTimeout(() => {
          addMarkersToMap();
        }, 100);
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
  }, [loading, enterprises]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when dischargeOutlets changes
  useEffect(() => {
    console.log('dischargeOutlets 更新:', dischargeOutlets);
    if (mapRef.current) {
      console.log('地图已初始化，调用 addMarkersToMap');
      addMarkersToMap();
    } else {
      console.log('地图未初始化，等待地图加载');
    }
  }, [dischargeOutlets]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{parkName || '园区'}</h1>
        <p className="text-sm text-gray-500 mt-1">共 {enterprises.length} 家企业</p>
      </div>

      {/* 企业列表 */}
      <div className="space-y-3">
        {enterprises.map((enterprise) => (
          <div
            key={enterprise.user_id}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{enterprise.company_name}</h3>
                <p className="text-sm text-gray-600 mt-1">负责人：{enterprise.full_name}</p>
                <p className="text-sm text-gray-600">
                  排污口：
                  <span className="text-blue-600 font-medium">{enterprise.outlet_count || 0}</span>
                  个
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {enterprise.latitude.toFixed(6)}, {enterprise.longitude.toFixed(6)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 地图 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">园区地图</h2>
        <div ref={mapContainerRef} className="w-full h-[500px] rounded-lg overflow-hidden" />
      </div>

      {/* 图例 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">图例</h3>
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow" />
            <span className="text-gray-600">企业</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow" />
            <span className="text-gray-600">排污口（已通过）</span>
          </div>
        </div>
      </div>
    </div>
  );
}
