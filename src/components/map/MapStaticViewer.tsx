'use client';

import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon broken on Next.js build
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const pinIcon = L.divIcon({
  html: `
    <div style="
      width: 28px; height: 28px;
      background: #ef4444;
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 10px rgba(239,68,68,0.6), 2px 2px 8px rgba(0,0,0,0.4);
    "></div>
  `,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

interface MapStaticViewerProps {
  lat: number;
  lng: number;
}

export default function MapStaticViewer({ lat, lng }: MapStaticViewerProps) {
  const isValidCoord = lat !== 0 || lng !== 0;

  if (!isValidCoord) {
    return (
      <div style={{
        width: '100%', height: '200px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(100,116,139,0.7)" strokeWidth="1.5">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5"/>
        </svg>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Koordinat tidak tersedia</p>
      </div>
    );
  }

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      style={{ width: '100%', height: '200px', borderRadius: 'var(--radius-md)' }}
      zoomControl={true}
      attributionControl={false}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      <Marker position={[lat, lng]} icon={pinIcon} />
    </MapContainer>
  );
}
