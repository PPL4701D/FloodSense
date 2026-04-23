'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapStore } from '@/stores/mapStore';
import { useRealtimeReports } from '@/lib/hooks/useRealtimeReports';
import HeatmapLayer from './HeatmapLayer';
import ClusterLayer from './ClusterLayer';
import LayerControl from './LayerControl';
import type { MapReport, SeverityLevel } from '@/types/database';
import { SEVERITY_LABELS } from '@/types/database';
import { Navigation, AlertTriangle, Droplets, Loader2, Info } from 'lucide-react';
import VoteButtons from '@/components/reports/VoteButtons';
import Link from 'next/link';

// Fix Leaflet default marker icon issue
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(L.Icon.Default.prototype as any)._getIconUrl = undefined;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Severity marker colors
const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  ringan: '#22c55e',
  sedang: '#eab308',
  berat: '#f97316',
  sangat_berat: '#ef4444',
};

function createSeverityIcon(severity: SeverityLevel) {
  const color = SEVERITY_COLORS[severity];
  return L.divIcon({
    html: `
      <div style="
        width: 28px; height: 28px;
        background: ${color};
        border: 3px solid rgba(255,255,255,0.9);
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      </div>
    `,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

// Tile layer URLs
const TILE_URLS = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

// Blue dot icon — Google Maps style
function createUserLocationIcon() {
  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 22px; height: 22px;
        display: flex; align-items: center; justify-content: center;
      ">
        <!-- Pulsing ring -->
        <div style="
          position: absolute;
          width: 44px; height: 44px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.15);
          animation: user-loc-pulse 2s ease-out infinite;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
        "></div>
        <!-- Blue dot -->
        <div style="
          width: 18px; height: 18px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.6);
          position: relative; z-index: 1;
        "></div>
      </div>
    `,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// User location blue dot component
interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

function UserLocationDot({ location }: { location: UserLocation | null }) {
  if (!location) return null;
  const icon = createUserLocationIcon();
  return (
    <>
      {/* Accuracy circle */}
      <Circle
        center={[location.lat, location.lng]}
        radius={location.accuracy}
        pathOptions={{
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.08,
          weight: 1,
          opacity: 0.4,
        }}
      />
      {/* Blue dot marker */}
      <Marker
        position={[location.lat, location.lng]}
        icon={icon}
        zIndexOffset={1000}
      >
        <Popup>
          <div style={{ fontFamily: 'Inter, sans-serif', padding: '0.25rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6', marginBottom: '0.25rem' }}>
              📍 Lokasi Anda
            </p>
            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Akurasi: ±{Math.round(location.accuracy)} m
            </p>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

// Locate button — sets view + triggers blue dot
function LocateButton({ userLocation, onLocate }: { userLocation: UserLocation | null; onLocate: (loc: UserLocation) => void }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const handleLocate = useCallback(() => {
    // Jika kita sudah punya lokasi dari auto-watcher (posisi saat ini valid), pan instan.
    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: UserLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        map.setView([loc.lat, loc.lng], 16, { animate: true });
        onLocate(loc);
        setLocating(false);
      },
      () => {
        // Fallback to Leaflet locate
        map.locate({ setView: true, maxZoom: 16 });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  }, [map, onLocate, userLocation]);

  return (
    <button
      onClick={handleLocate}
      title="Lokasi saya"
      style={{
        position: 'absolute', bottom: '108px', right: '16px', zIndex: 1000,
        width: '44px', height: '44px', borderRadius: '50%',
        background: locating ? 'rgba(59,130,246,0.7)' : '#3b82f6',
        border: '3px solid rgba(255,255,255,0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', boxShadow: '0 2px 12px rgba(59,130,246,0.5)',
        transition: 'all var(--transition-fast)',
      }}
    >
      {locating
        ? <Loader2 size={18} color="white" className="animate-spin" />
        : <Navigation size={18} color="white" />
      }
    </button>
  );
}

// Individual markers (non-clustered)
function ReportMarkers({ reports, onReportClick }: {
  reports: MapReport[];
  onReportClick?: (report: MapReport) => void;
}) {
  return (
    <>
      {reports.map((report) => (
        <Marker
          key={report.id}
          position={[report.lat, report.lng]}
          icon={createSeverityIcon(report.severity)}
          eventHandlers={{
            click: () => onReportClick?.(report),
          }}
        >
          <Popup>
            <div style={{
              minWidth: '200px', padding: '0.25rem',
              fontFamily: 'Inter, sans-serif',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Droplets size={14} color={SEVERITY_COLORS[report.severity]} />
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600,
                  color: SEVERITY_COLORS[report.severity],
                }}>
                  {SEVERITY_LABELS[report.severity]}
                </span>
              </div>
              {report.water_height_cm && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  Ketinggian air: <strong style={{ color: 'var(--text-primary)' }}>{report.water_height_cm} cm</strong>
                </p>
              )}
              {report.description && (
                <p style={{
                  fontSize: '0.75rem', color: 'var(--text-secondary)',
                  marginBottom: '0.375rem', lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {report.description}
                </p>
              )}
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {new Date(report.created_at).toLocaleString('id-ID', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
              
              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-primary)' }}>
                <VoteButtons reportId={report.id} compact />
              </div>
              
              <div style={{ marginTop: '0.5rem' }}>
                <Link
                  href={`/report/${report.id}`}
                  style={{
                    display: 'block', textAlign: 'center', padding: '6px 0',
                    background: 'var(--primary-500)', color: 'white',
                    borderRadius: 'var(--radius-sm)', textDecoration: 'none',
                    fontSize: '0.75rem', fontWeight: 600,
                    width: '100%'
                  }}
                >
                  Buka Detail / Validasi
                </Link>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

// Auto fit map to reports bounds when reports load
function AutoFitBounds({ reports }: { reports: MapReport[] }) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (reports.length > 0 && !hasFit.current) {
      const validReports = reports.filter(r => r.lat !== 0 && r.lng !== 0);
      if (validReports.length > 0) {
        if (validReports.length === 1) {
          map.setView([validReports[0].lat, validReports[0].lng], 14);
        } else {
          const bounds = L.latLngBounds(validReports.map(r => [r.lat, r.lng]));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
        hasFit.current = true;
      }
    }
  }, [reports, map]);

  return null;
}

export default function FloodMap() {
  const {
    reports,
    heatmapPoints,
    layerPreferences,
    isLoading,
    setLayerPreferences,
    setSelectedReport,
  } = useMapStore();

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  // Auto-watch position on mount (silent — only shows if user already granted permission)
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => { /* ignore errors silently */ },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Activate realtime subscription
  useRealtimeReports();

  // Indonesia center (Bandung/Java area as default)
  const center: [number, number] = [-6.9175, 107.6191];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <MapContainer
        center={center}
        zoom={5}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        {/* Base Tile Layer */}
        <TileLayer
          key={layerPreferences.baseLayer}
          url={TILE_URLS[layerPreferences.baseLayer]}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />

        {/* Auto-fit bounds */}
        <AutoFitBounds reports={reports} />

        {/* Heatmap Overlay */}
        <HeatmapLayer
          points={heatmapPoints}
          visible={layerPreferences.showHeatmap}
        />

        {/* Cluster Overlay */}
        <ClusterLayer
          reports={reports}
          visible={layerPreferences.showClusters}
          onReportClick={(report) => setSelectedReport(report)}
        />

        {/* Individual Markers (when clusters off) */}
        {layerPreferences.showMarkers && !layerPreferences.showClusters && (
          <ReportMarkers
            reports={reports}
            onReportClick={(report) => setSelectedReport(report)}
          />
        )}

        {/* User location blue dot */}
        <UserLocationDot location={userLocation} />

        <LocateButton userLocation={userLocation} onLocate={setUserLocation} />
      </MapContainer>

      {/* Layer Control */}
      <LayerControl
        preferences={layerPreferences}
        onChange={setLayerPreferences}
      />

      {/* Info Button (toggle legend) */}
      <button
        onClick={() => setShowLegend((v) => !v)}
        title="Level Banjir"
        style={{
          position: 'absolute', bottom: '164px', right: '16px', zIndex: 1000,
          width: '44px', height: '44px', borderRadius: '50%',
          background: showLegend ? 'var(--primary-500)' : 'var(--bg-card)',
          border: `1px solid ${showLegend ? 'var(--primary-400)' : 'var(--border-primary)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: 'var(--shadow-md)',
          transition: 'all var(--transition-fast)',
        }}
      >
        <Info size={20} color={showLegend ? 'white' : 'var(--text-secondary)'} />
      </button>

      {/* Legend Popup — appears above info button when open */}
      {showLegend && (
        <div className="glass" style={{
          position: 'absolute', bottom: '220px', right: '16px', zIndex: 1000,
          padding: '0.875rem', borderRadius: 'var(--radius-md)',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          minWidth: '150px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeInUp 0.15s ease-out',
        }}>
          <p style={{
            fontSize: '0.6875rem', fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: '0.125rem',
            letterSpacing: '0.03em', textTransform: 'uppercase',
          }}>
            Level Banjir
          </p>
          {(['ringan', 'sedang', 'berat', 'sangat_berat'] as SeverityLevel[]).map((sev) => (
            <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{
                width: '12px', height: '12px', borderRadius: '50%',
                background: SEVERITY_COLORS[sev],
                flexShrink: 0,
                boxShadow: `0 0 6px ${SEVERITY_COLORS[sev]}80`,
              }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {SEVERITY_LABELS[sev]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Report Count */}
      <div className="glass" style={{
        position: 'absolute', top: '16px', right: '16px', zIndex: 1000,
        padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'center', gap: '0.375rem',
      }}>
        {isLoading ? (
          <Loader2 size={14} color="var(--primary-400)" className="animate-spin" />
        ) : (
          <>
            <AlertTriangle size={14} color="var(--severity-sedang)" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              {reports.length}
            </span>
          </>
        )}
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
          laporan aktif
        </span>
      </div>
    </div>
  );
}
