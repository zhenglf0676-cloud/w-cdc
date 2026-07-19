'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number } | null) => void;
  disabled?: boolean;
}

export default function LocationPicker({ value, onChange, disabled }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamically import leaflet to avoid SSR issues
    const initMap = async () => {
      const L = await import('leaflet');

      // Fix default icon issue with webpack/nextjs
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

      // Initialize map with GaoDe tile layer
      const map = L.map(mapRef.current!, {
        center: [39.9042, 116.4074], // Beijing default
        zoom: 12,
        zoomControl: true,
      });

      // GaoDe tile layer (free, no API key needed)
      L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={z}&z={z}', {
        subdomains: '1234',
        maxZoom: 18,
        attribution: '&copy; 高德地图',
      }).addTo(map);

      // Fix tile URL template
      L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        subdomains: '1234',
        maxZoom: 18,
        attribution: '&copy; 高德地图',
      }).addTo(map);

      // Create custom icon
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: #0EA5E9; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });

      // Click handler
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;

        // Remove existing marker
        if (markerRef.current) {
          markerRef.current.remove();
        }

        // Add new marker
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        markerRef.current = marker;

        onChange({ lat, lng });
      });

      // If initial value, set marker
      if (value) {
        map.setView([value.lat, value.lng], 15);
        const marker = L.marker([value.lat, value.lng], { icon: customIcon }).addTo(map);
        markerRef.current = marker;
      }

      mapInstanceRef.current = map;
      setIsLoaded(true);

      // Force resize after mount
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

  // Update marker when value changes externally
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const L = require('leaflet');
    const map = mapInstanceRef.current;

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (value) {
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: #0EA5E9; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });

      map.setView([value.lat, value.lng], 15);
      const marker = L.marker([value.lat, value.lng], { icon: customIcon }).addTo(map);
      markerRef.current = marker;
    }
  }, [value, isLoaded]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[#0F172A]">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#64748B]" />
            企业位置
          </span>
        </label>
        {value && (
          <span className="text-xs text-[#64748B]">
            {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          </span>
        )}
      </div>
      <div
        ref={mapRef}
        className="h-[240px] w-full rounded-lg border border-[#E2E8F0] overflow-hidden relative"
        style={{ minHeight: '240px' }}
      />
      <p className="text-xs text-[#94A3B8]">
        点击地图选择企业位置
      </p>
    </div>
  );
}
