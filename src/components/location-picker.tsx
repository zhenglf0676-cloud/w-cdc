'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, CheckCircle2, X, Loader2, Crosshair, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number } | null) => void;
  onConfirm?: (location: { lat: number; lng: number; address: string }) => void;
  disabled?: boolean;
}

export default function LocationPicker({ value, onChange, onConfirm, disabled }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [manualInput, setManualInput] = useState({ lat: '', lng: '' });
  const [showManualInput, setShowManualInput] = useState(false);
  const [error, setError] = useState('');

  const createMarkerIcon = useCallback(async () => {
    const L = await import('leaflet');
    const color = isConfirmed ? '#10B981' : '#0EA5E9';
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background: ${color}; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });
  }, [isConfirmed]);

  const updateMarker = useCallback(async (lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;
    const L = await import('leaflet');
    const icon = await createMarkerIcon();

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      markerRef.current.setIcon(icon);
    } else {
      markerRef.current = L.marker([lat, lng], { icon, draggable: true });
      markerRef.current.addTo(mapInstanceRef.current);
      markerRef.current.on('dragend', async (e) => {
        const pos = e.target.getLatLng();
        setPendingLocation({ lat: pos.lat, lng: pos.lng });
        setManualInput({ lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) });
        setIsConfirmed(false);
        setAddress('');
      });
    }
  }, [createMarkerIcon]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = await import('leaflet');

      // Fix default icon paths
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [35.86, 104.19],
        zoom: 5,
        zoomControl: true,
      });

      // Use Gaode (AMap) tile layer - stable CDN
      L.tileLayer('https://wprd0{s}.is.autonavi.com/appmap/tile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', {
        subdomains: ['1', '2', '3', '4'],
        maxZoom: 18,
        attribution: '&copy; 高德地图',
      }).addTo(map);

      // Click to place marker
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setPendingLocation({ lat, lng });
        setManualInput({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
        setIsConfirmed(false);
        setAddress('');
        setError('');
        await updateMarker(lat, lng);
      });

      mapInstanceRef.current = map;
      setIsLoaded(true);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [updateMarker]);

  // Update marker when confirmed value changes
  useEffect(() => {
    if (value && isLoaded && mapInstanceRef.current) {
      updateMarker(value.lat, value.lng);
      mapInstanceRef.current.setView([value.lat, value.lng], 15);
    }
  }, [value, isLoaded, updateMarker]);

  // Fly to pending location
  useEffect(() => {
    if (pendingLocation && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([pendingLocation.lat, pendingLocation.lng], 16, { duration: 0.8 });
    }
  }, [pendingLocation]);

  const handleConfirm = () => {
    if (pendingLocation) {
      setIsConfirmed(true);
      onChange(pendingLocation);
      onConfirm?.({ lat: pendingLocation.lat, lng: pendingLocation.lng, address: address || `${pendingLocation.lat.toFixed(6)}, ${pendingLocation.lng.toFixed(6)}` });
    }
  };

  const handleReset = () => {
    setPendingLocation(null);
    setIsConfirmed(false);
    setAddress('');
    setManualInput({ lat: '', lng: '' });
    setError('');
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    onChange(null);
  };

  const handleManualLocate = async () => {
    const lat = parseFloat(manualInput.lat);
    const lng = parseFloat(manualInput.lng);
    if (isNaN(lat) || isNaN(lng)) {
      setError('请输入有效的经纬度');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError('经纬度范围：纬度 -90~90，经度 -180~180');
      return;
    }
    setError('');
    setPendingLocation({ lat, lng });
    setIsConfirmed(false);
    setAddress('');
    await updateMarker(lat, lng);
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setError('浏览器不支持定位');
      return;
    }
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPendingLocation({ lat: latitude, lng: longitude });
        setManualInput({ lat: latitude.toFixed(6), lng: longitude.toFixed(6) });
        setIsConfirmed(false);
        setAddress('');
        await updateMarker(latitude, longitude);
      },
      () => {
        setError('获取位置失败，请手动输入坐标或在地图上点击');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-sky-500" />
          企业位置
        </label>
        {isConfirmed && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 位置已确认
          </span>
        )}
      </div>

      {/* Map Container */}
      <div className="relative border border-slate-200 rounded-lg overflow-hidden">
        <div ref={mapRef} className="w-full h-[320px] bg-slate-100" />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> 加载地图...
            </div>
          </div>
        )}
        {/* Crosshair overlay */}
        {isLoaded && !pendingLocation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-slate-400 text-sm bg-white/80 px-3 py-1.5 rounded-full shadow-sm">
              点击地图选择位置
            </div>
          </div>
        )}
      </div>

      {/* Coordinate Input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            {showManualInput ? '收起坐标输入' : '手动输入坐标'}
          </button>
          <button
            type="button"
            onClick={handleGeolocation}
            className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            <Crosshair className="w-3 h-3" />
            自动定位
          </button>
        </div>

        {showManualInput && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">纬度 (Latitude)</label>
              <Input
                type="text"
                placeholder="如：30.274084"
                value={manualInput.lat}
                onChange={(e) => setManualInput({ ...manualInput, lat: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">经度 (Longitude)</label>
              <Input
                type="text"
                placeholder="如：120.155071"
                value={manualInput.lng}
                onChange={(e) => setManualInput({ ...manualInput, lng: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleManualLocate}
              className="h-9"
            >
              定位
            </Button>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {/* Pending location info */}
      {pendingLocation && !isConfirmed && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-sky-700 font-medium">待确认位置</span>
            <button type="button" onClick={handleReset} className="text-sky-400 hover:text-sky-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-sky-600 space-y-0.5">
            <p>纬度：{pendingLocation.lat.toFixed(6)}</p>
            <p>经度：{pendingLocation.lng.toFixed(6)}</p>
            {address && <p>地址：{address}</p>}
          </div>
          <Button
            type="button"
            onClick={handleConfirm}
            size="sm"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            确认此位置
          </Button>
        </div>
      )}

      {/* Confirmed location info */}
      {isConfirmed && pendingLocation && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> 已确认
            </span>
            <button type="button" onClick={handleReset} className="text-xs text-emerald-500 hover:text-emerald-700">
              重新选择
            </button>
          </div>
          <div className="text-xs text-emerald-600">
            {pendingLocation.lat.toFixed(6)}, {pendingLocation.lng.toFixed(6)}
            {address && ` · ${address}`}
          </div>
        </div>
      )}
    </div>
  );
}
