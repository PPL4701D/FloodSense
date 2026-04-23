'use client';

import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
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
  onChange: (lat: number, lng: number) => void;
}

// Helper component to recenter map when lat/lng change from outside (e.g. initial GPS)
function MapCenterer({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

export default function LocationPickerMap({ lat, lng, onChange }: LocationPickerProps) {
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
        <MapCenterer lat={lat} lng={lng} />
        <Marker 
          position={[lat, lng]} 
          draggable={true}
          icon={pinIcon}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const pos = marker.getLatLng();
              onChange(pos.lat, pos.lng);
            }
          }}
        />
      </MapContainer>
      <div style={{
        position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
        padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(51, 65, 85, 0.5)',
        fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center',
        pointerEvents: 'none'
      }}>
        Geser pin merah untuk penyesuaian (tahan & geser)
      </div>
    </div>
  );
}
