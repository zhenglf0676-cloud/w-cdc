'use client';

import { useEffect, useState } from 'react';
import { MapPin, Building2, AlertCircle } from 'lucide-react';

interface Enterprise {
  user_id: string;
  full_name: string;
  company_name: string;
  park_name: string;
  latitude: number;
  longitude: number;
}

export default function AdminHome() {
  const [parkName, setParkName] = useState('');
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [map, setMap] = useState<any>(null);
  const [AMap, setAMap] = useState<any>(null);

  useEffect(() => {
    // 加载数据
    fetch('/api/admin/park-enterprises')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setParkName(data.data.parkName);
          setEnterprises(data.data.enterprises);
        }
      })
      .finally(() => setLoading(false));

    // 加载高德地图
    import('@amap/amap-jsapi-loader').then((AMapLoader) => {
      (window as any)._AMapSecurityConfig = {
        securityJsCode: '0ab574a1c887c61ecaa4af9250d8563d',
      };

      AMapLoader.load({
        key: '7f34d9a440f2d86314844ab310e966fd',
        version: '2.0',
        plugins: [],
      }).then((mapInstance: any) => {
        setAMap(mapInstance);
      });
    });
  }, []);

  useEffect(() => {
    if (!AMap || enterprises.length === 0) return;

    const mapInstance = new AMap.Map('admin-map', {
      zoom: 13,
      center: [enterprises[0].longitude, enterprises[0].latitude],
      mapStyle: 'amap://styles/normal',
    });

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
        const infoWindow = new AMap.InfoWindow({
          content: `
            <div class="info-window">
              <h3>${enterprise.company_name}</h3>
              <p>负责人：${enterprise.full_name}</p>
              <p>所属园区：${enterprise.park_name}</p>
              <p>位置：${enterprise.latitude.toFixed(6)}, ${enterprise.longitude.toFixed(6)}</p>
            </div>
          `,
          offset: new AMap.Pixel(0, -30),
        });
        infoWindow.open(mapInstance, marker.getPosition());
      });

      mapInstance.add(marker);
    });

    setMap(mapInstance);

    return () => {
      if (mapInstance) {
        mapInstance.destroy();
      }
    };
  }, [AMap, enterprises]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">{parkName} - 园区监控</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>企业数量：{enterprises.length}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* 地图区域 */}
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="mb-4 text-lg font-semibold">园区地图</h2>
              <div id="admin-map" className="h-[600px] w-full rounded-md" />
            </div>
          </div>

          {/* 侧边栏 - 企业列表 */}
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="mb-4 text-lg font-semibold">企业列表</h2>
              {enterprises.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">暂无企业数据</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {enterprises.map((enterprise) => (
                    <div
                      key={enterprise.user_id}
                      className="rounded-md border p-3 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <Building2 className="h-5 w-5 text-primary mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">
                            {enterprise.company_name}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            负责人：{enterprise.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {enterprise.latitude.toFixed(6)},{' '}
                            {enterprise.longitude.toFixed(6)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 图例 */}
            <div className="rounded-lg border bg-card p-4">
              <h2 className="mb-4 text-lg font-semibold">图例</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-primary" />
                  <span className="text-sm">企业位置</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
