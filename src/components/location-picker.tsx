'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Search } from 'lucide-react';

interface LocationPickerProps {
  value?: { lat: number; lng: number };
  onChange: (location: { lat: number; lng: number; address: string }) => void;
  confirmed?: boolean;
  onConfirm?: (location: { lat: number; lng: number; address: string }) => void;
}

// 高德地图配置
const AMAP_KEY = '7f34d9a440f2d86314844ab310e966fd';
const AMAP_SECURITY_KEY = '0ab574a1c887c61ecaa4af9250d8563d';

export function LocationPicker({ value, onChange, confirmed, onConfirm }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState('');
  const [amapLoaded, setAmapLoaded] = useState(false);

  // 动态加载高德地图
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 设置安全密钥
    (window as any)._AMapSecurityConfig = {
      securityJsCode: AMAP_SECURITY_KEY,
    };

    // 动态导入 AMapLoader
    import('@amap/amap-jsapi-loader')
      .then((AMapLoader) => {
        return AMapLoader.default.load({
          key: AMAP_KEY,
          version: '2.0',
          plugins: ['AMap.Geocoder', 'AMap.PlaceSearch'],
        });
      })
      .then((AMap) => {
        if (!mapRef.current) return;

        const map = new AMap.Map(mapRef.current, {
          zoom: 13,
          center: [116.397428, 39.90923], // 北京
        });

        mapInstanceRef.current = map;
        geocoderRef.current = new AMap.Geocoder();
        setAmapLoaded(true);

        // 点击地图选点
        map.on('click', (e: any) => {
          const lng = e.lnglat.getLng();
          const lat = e.lnglat.getLat();
          updateMarker(lng, lat);
          reverseGeocode(lng, lat);
        });

        // 如果有初始值
        if (value) {
          updateMarker(value.lng, value.lat);
          reverseGeocode(value.lng, value.lat);
          map.setCenter([value.lng, value.lat]);
        }

        setLoading(false);
      })
      .catch((e) => {
        console.error('高德地图加载失败:', e);
        setLoading(false);
      });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
      }
    };
  }, []);

  // 逆地理编码
  const reverseGeocode = useCallback((lng: number, lat: number) => {
    if (!geocoderRef.current) return;

    geocoderRef.current.getAddress([lng, lat], (status: string, result: any) => {
      if (status === 'complete' && result.regeocode) {
        const addr = result.regeocode.formattedAddress;
        setAddress(addr);
        onChange({ lat, lng, address: addr });
      }
    });
  }, [onChange]);

  // 更新标记
  const updateMarker = useCallback((lng: number, lat: number) => {
    const AMap = (window as any).AMap;
    if (!AMap || !mapInstanceRef.current) return;

    if (markerRef.current) {
      markerRef.current.setPosition([lng, lat]);
    } else {
      markerRef.current = new AMap.Marker({
        position: [lng, lat],
        cursor: 'pointer',
        draggable: true,
        map: mapInstanceRef.current,
      });

      // 拖拽结束
      markerRef.current.on('dragend', (e: any) => {
        const lng = e.lnglat.getLng();
        const lat = e.lnglat.getLat();
        reverseGeocode(lng, lat);
      });
    }

    onChange({ lat, lng, address: '' });
  }, [onChange, reverseGeocode]);

  // 搜索地址
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;

    const AMap = (window as any).AMap;
    if (!AMap || !geocoderRef.current) return;

    geocoderRef.current.getLocation(searchQuery, (status: string, result: any) => {
      if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
        const geocode = result.geocodes[0];
        const location = geocode.location;
        const lng = location.getLng();
        const lat = location.getLat();

        updateMarker(lng, lat);
        setAddress(geocode.formattedAddress);
        mapInstanceRef.current?.setCenter([lng, lat]);
        mapInstanceRef.current?.setZoom(15);
        setSearchResults([]);
        setShowResults(false);
      }
    });
  }, [searchQuery, updateMarker]);

  // 输入提示
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const AMap = (window as any).AMap;
    if (!AMap || !amapLoaded) return;

    // 使用 PlaceSearch 进行输入提示
    const placeSearch = new AMap.PlaceSearch({
      pageSize: 5,
      pageIndex: 1,
    });

    placeSearch.search(query, (status: string, result: any) => {
      if (status === 'complete' && result.poiList && result.poiList.pois) {
        setSearchResults(result.poiList.pois);
        setShowResults(true);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    });
  }, [amapLoaded]);

  // 选择搜索结果
  const handleSelectResult = useCallback((poi: any) => {
    const lng = poi.location.getLng();
    const lat = poi.location.getLat();

    updateMarker(lng, lat);
    setAddress(poi.name + ' - ' + poi.address);
    mapInstanceRef.current?.setCenter([lng, lat]);
    mapInstanceRef.current?.setZoom(15);
    setSearchQuery(poi.name);
    setSearchResults([]);
    setShowResults(false);
  }, [updateMarker]);

  return (
    <div className="space-y-3">
      {/* 搜索框 */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索地址（如：XX市XX区XX路）"
            className="flex-1 h-10 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="flex items-center gap-1 px-4 h-10 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
          >
            <Search className="w-4 h-4" />
            搜索
          </button>
        </div>

        {/* 搜索结果下拉 */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-60 overflow-auto">
            {searchResults.map((poi, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectResult(poi)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-900">{poi.name}</div>
                <div className="text-xs text-gray-500 truncate">{poi.address}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 地图容器 */}
      <div className="relative">
        <div
          ref={mapRef}
          className="w-full h-64 border border-gray-300 rounded-md bg-gray-50"
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-md">
            <div className="text-sm text-gray-500">地图加载中...</div>
          </div>
        )}
      </div>

      {/* 地址和坐标信息 */}
      {address && (
        <div className="text-sm space-y-1">
          <div className="text-gray-700">
            <span className="font-medium">地址：</span>
            {address}
          </div>
          {value && (
            <div className="text-gray-500 text-xs">
              坐标：{value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </div>
          )}
        </div>
      )}

      {/* 确认按钮 */}
      {value && !confirmed && onConfirm && (
        <button
          type="button"
          onClick={() => {
            onConfirm({ lat: value.lat, lng: value.lng, address });
            // 显示确认反馈
            const btn = document.getElementById('location-confirm-btn');
            if (btn) {
              btn.textContent = '✓ 位置已确认';
              btn.className = 'w-full py-2 bg-green-600 text-white text-sm rounded-md transition-colors';
              setTimeout(() => {
                btn.textContent = '确认此位置';
                btn.className = 'w-full py-2 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors';
              }, 2000);
            }
          }}
          id="location-confirm-btn"
          className="w-full py-2 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
        >
          确认此位置
        </button>
      )}

      {confirmed && value && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          位置已确认 · {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
        </div>
      )}
    </div>
  );
}
