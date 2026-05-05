'use client';

import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';

const pinIcon = L.divIcon({
  html: `
    <div style="
      width: 24px; height: 24px;
      background: #ef4444;
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 2px 2px 8px rgba(0,0,0,0.4);
    "></div>
  `,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 24] // anchor at the bottom tip
});

interface LocationPickerProps {
  lat: number;
  lng: number;
  onChange?: (lat: number, lng: number) => void;
  radiusKm?: number;
}

function MapCenterer({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm?: number }) {
  const map = useMap();
  useEffect(() => {
    if (radiusKm && radiusKm > 0) {
      const center = L.latLng(lat, lng);
      const bounds = center.toBounds(radiusKm * 2 * 1000);
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 });
    } else {
      map.setView([lat, lng]);
    }
  }, [lat, lng, radiusKm, map]);
  return null;
}

export default function LocationPickerMap({ lat, lng, onChange, radiusKm }: LocationPickerProps) {
  return (
    <div style={{ 
      width: '100%', 
      height: '240px', 
      borderRadius: 'var(--radius-md)', 
      overflow: 'hidden', 
      position: 'relative',
      border: '1px solid var(--border-primary)'
    }}>
      <MapContainer 
        center={[lat, lng]} 
        zoom={16} 
        style={{ width: '100%', height: '100%' }} 
        zoomControl={false} 
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapCenterer lat={lat} lng={lng} radiusKm={radiusKm} />
        {radiusKm != null && radiusKm > 0 && (
          <Circle
            center={[lat, lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: '#94a3b8',
              weight: 1.5,
              fillColor: '#94a3b8',
              fillOpacity: 0.12,
              dashArray: '6 4',
            }}
          />
        )}
        <Marker 
          position={[lat, lng]} 
          draggable={!!onChange}
          icon={pinIcon}
          eventHandlers={onChange ? {
            dragend: (e) => {
              const marker = e.target;
              const pos = marker.getLatLng();
              onChange(pos.lat, pos.lng);
            }
          } : {}}
        />
      </MapContainer>
      {onChange && (
        <div style={{
          position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
          padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(51, 65, 85, 0.5)',
          fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center',
          pointerEvents: 'none'
        }}>
          Geser pin merah untuk penyesuaian (tahan & geser)
        </div>
      )}
    </div>
  );
}
