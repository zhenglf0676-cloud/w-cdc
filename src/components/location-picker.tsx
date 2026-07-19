'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Search, CheckCircle2, X, Loader2, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number } | null) => void;
  onConfirm?: (location: { lat: number; lng: number; address: string }) => void;
  disabled?: boolean;
}

interface SearchResult {
  lat: number;
  lng: number;
  displayName: string;
}

export default function LocationPicker({ value, onChange, onConfirm, disabled }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const createMarkerIcon = useCallback(async () => {
    const L = await import('leaflet');
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background: ${isConfirmed ? '#10B981' : '#0EA5E9'}; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
        <svg style="transform: rotate(45deg); width: 12px; height: 12px;" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
  }, [isConfirmed]);

  // Reverse geocode using Nominatim
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=zh-CN`,
        { headers: { 'User-Agent': 'GroundwaterMonitorApp/1.0' } }
      );
      const data = await response.json();
      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }, []);

  // Search address using Nominatim
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1&accept-language=zh-CN`,
        { headers: { 'User-Agent': 'GroundwaterMonitorApp/1.0' } }
      );
      const data: Array<{ lat: string; lon: string; display_name: string }> = await response.json();
      const results: SearchResult[] = data.map((item) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name,
      }));
      setSearchResults(results);
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = await import('leaflet');
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

      const map = L.map(mapRef.current!, {
        center: [35.8617, 104.1954], // China center
        zoom: 5,
        zoomControl: true,
      });

      // GaoDe tile layer
      L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        subdomains: '1234',
        maxZoom: 18,
        attribution: '&copy; 高德地图',
      }).addTo(map);

      // Click handler
      map.on('click', async (e: L.LeafletMouseEvent) => {
        if (disabled) return;
        const { lat, lng } = e.latlng;

        // Remove existing marker
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }

        // Add pending marker (blue)
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background: #0EA5E9; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map);
        markerRef.current = marker;

        setPendingLocation({ lat, lng });
        setIsConfirmed(false);
        onChange({ lat, lng });

        // Reverse geocode
        const addr = await reverseGeocode(lat, lng);
        setAddress(addr);
      });

      // If initial value, set marker
      if (value) {
        map.setView([value.lat, value.lng], 15);
        const icon = await createMarkerIcon();
        const marker = L.marker([value.lat, value.lng], { icon }).addTo(map);
        markerRef.current = marker;
        setPendingLocation(value);
        const addr = await reverseGeocode(value.lat, value.lng);
        setAddress(addr);
      }

      mapInstanceRef.current = map;
      setIsLoaded(true);

      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle confirm location
  const handleConfirm = useCallback(() => {
    if (!pendingLocation) return;
    setIsConfirmed(true);

    // Update marker to green
    if (mapInstanceRef.current && markerRef.current) {
      const L = require('leaflet');
      const greenIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: #10B981; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <svg style="transform: rotate(45deg); width: 14px; height: 14px;" fill="white" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      markerRef.current.setIcon(greenIcon);
    }

    if (onConfirm) {
      onConfirm({ ...pendingLocation, address });
    }
  }, [pendingLocation, address, onConfirm]);

  // Handle select search result
  const handleSelectResult = useCallback(async (result: SearchResult) => {
    if (!mapInstanceRef.current) return;
    setShowResults(false);
    setSearchQuery('');

    const map = mapInstanceRef.current;
    map.setView([result.lat, result.lng], 16);

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    // Add pending marker
    const L = await import('leaflet');
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="background: #0EA5E9; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });

    const marker = L.marker([result.lat, result.lng], { icon }).addTo(map);
    markerRef.current = marker;

    setPendingLocation({ lat: result.lat, lng: result.lng });
    setIsConfirmed(false);
    onChange({ lat: result.lat, lng: result.lng });
    setAddress(result.displayName);
  }, [onChange]);

  // Handle reset
  const handleReset = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    setPendingLocation(null);
    setAddress('');
    setIsConfirmed(false);
    onChange(null);
  }, [onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[#0F172A]">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#64748B]" />
            企业位置
          </span>
        </label>
        {pendingLocation && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#64748B]"
          >
            <X className="h-3 w-3" />
            清除
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              type="text"
              placeholder="搜索地址（如：北京市朝阳区xx路xx号）"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-9 pl-9 border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8]"
              disabled={disabled}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSearch}
            disabled={isSearching || disabled || !searchQuery.trim()}
            className="h-9 px-3 border-[#E2E8F0] text-[#0EA5E9] hover:bg-[#0EA5E9]/5"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : '搜索'}
          </Button>
        </div>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white shadow-lg max-h-[200px] overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectResult(result)}
                className="w-full px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F1F5F9] border-b border-[#F1F5F9] last:border-0"
              >
                <div className="flex items-start gap-2">
                  <Navigation className="h-3.5 w-3.5 mt-0.5 text-[#94A3B8] shrink-0" />
                  <span className="line-clamp-2">{result.displayName}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        {showResults && searchResults.length === 0 && !isSearching && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-lg">
            <p className="text-sm text-[#94A3B8] text-center">未找到相关地址</p>
          </div>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="h-[280px] w-full rounded-lg border border-[#E2E8F0] overflow-hidden relative"
        style={{ minHeight: '280px' }}
      />

      {/* Address display */}
      {pendingLocation && (
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2">
          <div className="flex items-start gap-2">
            <MapPin className={`h-4 w-4 mt-0.5 shrink-0 ${isConfirmed ? 'text-[#10B981]' : 'text-[#0EA5E9]'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0F172A] line-clamp-2">{address}</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                经度: {pendingLocation.lng.toFixed(6)} | 纬度: {pendingLocation.lat.toFixed(6)}
              </p>
            </div>
          </div>

          {!isConfirmed ? (
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              className="w-full h-8 bg-[#10B981] text-white hover:bg-[#059669] text-sm"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              确认此位置
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-[#10B981] font-medium">
              <CheckCircle2 className="h-4 w-4" />
              位置已确认
            </div>
          )}
        </div>
      )}

      {!pendingLocation && (
        <p className="text-xs text-[#94A3B8] text-center">
          点击地图或搜索地址选择企业位置，然后确认
        </p>
      )}
    </div>
  );
}
