"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Enterprise {
  id: string;
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
  user_id: string;
  latitude: number;
  longitude: number;
  status: string;
  profiles?: {
    company_name: string;
  };
}

export default function AdminPage() {
  const { session } = useAuth();
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [dischargeOutlets, setDischargeOutlets] = useState<DischargeOutlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const enterpriseMarkersRef = useRef<any[]>([]);
  const outletMarkersRef = useRef<any[]>([]);
  const dischargeOutletsRef = useRef<DischargeOutlet[]>([]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session) return;

      try {
        const [enterprisesRes, outletsRes] = await Promise.all([
          fetch("/api/admin/park-enterprises", {
            headers: { "x-session": session.access_token },
          }),
          fetch("/api/discharge-outlets/approved", {
            headers: { "x-session": session.access_token },
          }),
        ]);

        const enterprisesData = await enterprisesRes.json();
        const outletsData = await outletsRes.json();

        if (enterprisesRes.ok && Array.isArray(enterprisesData)) {
          setEnterprises(enterprisesData);
        }

        if (outletsRes.ok && Array.isArray(outletsData)) {
          setDischargeOutlets(outletsData);
          dischargeOutletsRef.current = outletsData;
          console.log("获取到排污口数据:", outletsData);
        } else {
          console.error("获取排污口数据失败:", outletsData.error);
        }
      } catch (error) {
        console.error("获取数据失败:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  // 动态加载高德地图
  useEffect(() => {
    if (loading || enterprises.length === 0 || !mapContainerRef.current) return;

    let mapInstance: any = null;

    import("@amap/amap-jsapi-loader")
      .then((AMapLoader) => {
        (window as any)._AMapSecurityConfig = {
          securityJsCode: "0ab574a1c887c61ecaa4af9250d8563d",
        };

        return AMapLoader.load({
          key: "7f34d9a440f2d86314844ab310e966fd",
          version: "2.0",
          plugins: [],
        });
      })
      .then((AMap: any) => {
        if (!mapContainerRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.destroy();
          mapInstanceRef.current = null;
        }

        mapInstance = new AMap.Map(mapContainerRef.current, {
          zoom: 13,
          center: [106.3067, 29.5332],
          mapStyle: "amap://styles/normal",
        });
        mapInstanceRef.current = mapInstance;

        (window as any).__AMap__ = AMap;

        setTimeout(() => {
          addMarkersToMap();
        }, 100);
      })
      .catch((err) => {
        console.error("地图加载失败:", err);
        setMapError("地图加载失败，请刷新页面重试");
      });

    return () => {
      if (mapInstance) {
        mapInstance.destroy();
      }
    };
  }, [loading, enterprises]);

  // Helper function to add markers to map
  const addMarkersToMap = () => {
    const AMap = (window as any).__AMap__ || (window as any).AMap;
    const map = mapInstanceRef.current;

    if (!AMap || !map) return;

    // Clear old markers
    enterpriseMarkersRef.current.forEach((marker) => marker.setMap(null));
    outletMarkersRef.current.forEach((marker) => marker.setMap(null));

    // Add enterprise markers
    enterprises.forEach((enterprise) => {
      const markerContent = document.createElement("div");
      markerContent.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        background: #3B82F6; border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: bold; font-size: 14px;
      `;
      markerContent.innerHTML = "<span>企</span>";

      const marker = new AMap.Marker({
        position: new AMap.LngLat(enterprise.longitude, enterprise.latitude),
        content: markerContent,
        offset: new AMap.Pixel(-16, -16),
      });

      const outletCount = dischargeOutletsRef.current.filter(
        (o) => o.user_id === enterprise.user_id && o.status === "approved"
      ).length;

      marker.on("click", () => {
        const infoWindow = new AMap.InfoWindow({
          content: `
            <div style="padding:10px;min-width:200px;font-family:'Noto Sans SC',sans-serif;">
              <div style="font-weight:600;font-size:14px;margin-bottom:6px;">${enterprise.company_name}</div>
              <div style="font-size:12px;color:#64748B;margin-bottom:4px;">负责人：${enterprise.full_name}</div>
              <div style="font-size:12px;color:#64748B;margin-bottom:4px;">所属园区：${enterprise.park_name}</div>
              <div style="font-size:12px;margin-bottom:4px;">排污口数量：<span style="color:#10B981;font-weight:500;">${outletCount}</span></div>
              <div style="font-size:12px;color:#94A3B8;">位置：${enterprise.latitude}, ${enterprise.longitude}</div>
            </div>
          `,
          offset: new AMap.Pixel(0, -30),
        });
        infoWindow.open(map, marker.getPosition());
      });

      map.add(marker);
      enterpriseMarkersRef.current.push(marker);
    });

    // Add discharge outlet markers
    const approvedOutlets = dischargeOutletsRef.current.filter(
      (outlet) => outlet.status === "approved"
    );

    approvedOutlets.forEach((outlet) => {
      const markerContent = document.createElement("div");
      markerContent.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        background: #10B981; border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: bold; font-size: 12px;
      `;
      markerContent.innerHTML = "<span>排</span>";

      const marker = new AMap.Marker({
        position: new AMap.LngLat(outlet.longitude, outlet.latitude),
        content: markerContent,
        offset: new AMap.Pixel(-14, -14),
      });

      const companyName = outlet.profiles?.company_name || "未知企业";

      marker.on("click", () => {
        const infoWindow = new AMap.InfoWindow({
          content: `
            <div style="padding:10px;min-width:180px;font-family:'Noto Sans SC',sans-serif;">
              <div style="font-weight:600;font-size:14px;margin-bottom:6px;">${outlet.name}</div>
              <div style="font-size:12px;color:#64748B;margin-bottom:4px;">${companyName}</div>
              <div style="font-size:12px;">
                状态：<span style="color:#10B981;font-weight:500;">已通过</span>
              </div>
            </div>
          `,
          offset: new AMap.Pixel(0, -30),
        });
        infoWindow.open(map, marker.getPosition());
      });

      map.add(marker);
      outletMarkersRef.current.push(marker);
    });

    console.log("addMarkersToMap 调用:", {
      hasAMap: !!AMap,
      hasMap: !!map,
      enterpriseCount: enterprises.length,
      outletCount: approvedOutlets.length,
    });
  };

  // Update markers when dischargeOutlets changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      addMarkersToMap();
    }
  }, [dischargeOutlets]);

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

  if (!session) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">大学城</h1>
        <p className="text-sm text-gray-500 mt-1">共 {enterprises.length} 家企业</p>
      </div>

      {/* 园区地图 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>园区地图</CardTitle>
        </CardHeader>
        <CardContent>
          {mapError ? (
            <div className="h-[500px] flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">{mapError}</p>
            </div>
          ) : (
            <>
              <div
                ref={mapContainerRef}
                className="h-[500px] rounded-lg overflow-hidden"
              />
              <div className="mt-4 flex gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow"></div>
                  <span className="text-gray-600">企业</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow"></div>
                  <span className="text-gray-600">排污口（已通过）</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 企业列表 */}
      <div className="space-y-4">
        {enterprises.map((enterprise) => (
          <Card key={enterprise.id}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {enterprise.company_name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    负责人：{enterprise.full_name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    排污口：
                    <span className="text-blue-600 font-medium">
                      {enterprise.outlet_count || 0}
                    </span>{" "}
                    个
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {enterprise.latitude}, {enterprise.longitude}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
