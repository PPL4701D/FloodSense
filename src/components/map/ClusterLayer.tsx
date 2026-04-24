'use client';

import { Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import type { MapReport, SeverityLevel, AreaStatusLevel } from '@/types/database';
import { SEVERITY_LABELS, AREA_STATUS_COLORS, AREA_STATUS_LABELS } from '@/types/database';
import VoteButtons from '@/components/reports/VoteButtons';
import Link from 'next/link';

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  ringan: '#22c55e',
  sedang: '#eab308',
  berat: '#f97316',
  sangat_berat: '#ef4444',
};

function createSeverityIcon(severity: SeverityLevel, areaStatus?: AreaStatusLevel) {
  const severityColor = SEVERITY_COLORS[severity];
  const showRing = areaStatus && areaStatus !== 'normal';
  const ringColor = showRing ? AREA_STATUS_COLORS[areaStatus] : null;
  const size = showRing ? 38 : 28;
  const half = size / 2;

  const ringHtml = ringColor
    ? `<div style="
        position: absolute;
        width: ${size}px; height: ${size}px;
        border-radius: 50%;
        border: 2.5px solid ${ringColor};
        box-shadow: 0 0 8px ${ringColor}99;
        animation: area-status-ring-pulse 2s ease-in-out infinite;
      "></div>`
    : '';

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${size}px; height: ${size}px;
        display: flex; align-items: center; justify-content: center;
      ">
        ${ringHtml}
        <div style="
          width: 28px; height: 28px;
          background: ${severityColor};
          border: 3px solid rgba(255,255,255,0.9);
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          position: relative; z-index: 1;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
        </div>
      </div>
    `,
    className: '',
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  const markers = cluster.getAllChildMarkers();

  const severityCounts: Record<SeverityLevel, number> = {
    ringan: 0, sedang: 0, berat: 0, sangat_berat: 0,
  };

  markers.forEach((marker: L.Marker) => {
    const severity = (marker.options as { severity?: SeverityLevel }).severity;
    if (severity) severityCounts[severity]++;
  });

  const dominantSeverity = (['sangat_berat', 'berat', 'sedang', 'ringan'] as SeverityLevel[])
    .find((s) => severityCounts[s] > 0) || 'ringan';

  const color = SEVERITY_COLORS[dominantSeverity];
  const size = count < 10 ? 40 : count < 50 ? 48 : 56;

  return L.divIcon({
    html: `
      <div style="
        width: ${size}px; height: ${size}px;
        background: ${color};
        border: 3px solid rgba(255,255,255,0.8);
        border-radius: 50%;
        box-shadow: 0 3px 12px ${color}66;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Inter', sans-serif;
        font-weight: 700;
        font-size: ${count < 10 ? '14px' : '12px'};
        color: white;
      ">
        ${count}
      </div>
    `,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface ClusterLayerProps {
  reports: MapReport[];
  visible: boolean;
  areaStatusMap?: Map<string, AreaStatusLevel>;
  onReportClick?: (report: MapReport) => void;
}

export default function ClusterLayer({ reports, visible, areaStatusMap, onReportClick }: ClusterLayerProps) {
  if (!visible || reports.length === 0) return null;

  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={50}
      spiderfyOnMaxZoom
      showCoverageOnHover={false}
      iconCreateFunction={createClusterIcon}
    >
      {reports.map((report) => {
        const areaStatus = report.region_id ? areaStatusMap?.get(report.region_id) : undefined;
        const showAreaBadge = areaStatus && areaStatus !== 'normal';

        return (
          <Marker
            key={report.id}
            position={[report.lat, report.lng]}
            icon={createSeverityIcon(report.severity, areaStatus)}
            eventHandlers={{ click: () => onReportClick?.(report) }}
            // @ts-expect-error - custom option for cluster icon calculation
            severity={report.severity}
          >
            <Popup>
              <div style={{
                minWidth: '200px', padding: '0.25rem',
                fontFamily: 'Inter, sans-serif',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: SEVERITY_COLORS[report.severity],
                  }} />
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    color: SEVERITY_COLORS[report.severity],
                  }}>
                    {SEVERITY_LABELS[report.severity]}
                  </span>
                  <span style={{
                    fontSize: '0.625rem', padding: '2px 6px', borderRadius: '4px',
                    background: report.status === 'verified' ? 'rgba(34,197,94,0.15)' :
                      report.status === 'pending' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                    color: report.status === 'verified' ? '#22c55e' :
                      report.status === 'pending' ? '#eab308' : '#ef4444',
                    fontWeight: 500,
                  }}>
                    {report.status === 'verified' ? 'Terverifikasi' :
                      report.status === 'pending' ? 'Menunggu' : report.status}
                  </span>
                </div>

                {showAreaBadge && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    marginBottom: '0.5rem', padding: '4px 8px', borderRadius: '6px',
                    background: `${AREA_STATUS_COLORS[areaStatus]}22`,
                    border: `1px solid ${AREA_STATUS_COLORS[areaStatus]}55`,
                  }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: AREA_STATUS_COLORS[areaStatus], flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600,
                      color: AREA_STATUS_COLORS[areaStatus],
                    }}>
                      Status Area: {AREA_STATUS_LABELS[areaStatus]}
                    </span>
                  </div>
                )}

                {report.water_height_cm && (
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.375rem' }}>
                    Ketinggian air: <strong style={{ color: '#e2e8f0' }}>{report.water_height_cm} cm</strong>
                  </p>
                )}

                {report.description && (
                  <p style={{
                    fontSize: '0.75rem', color: '#94a3b8',
                    marginBottom: '0.375rem', lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {report.description}
                  </p>
                )}

                <p style={{ fontSize: '0.6875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  {new Date(report.created_at).toLocaleString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>

                <div style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <VoteButtons reportId={report.id} compact />
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <Link
                    href={`/report/${report.id}`}
                    style={{
                      display: 'block', textAlign: 'center', padding: '6px 0',
                      background: 'var(--primary-500)', color: 'white',
                      borderRadius: 'var(--radius-sm)', textDecoration: 'none',
                      fontSize: '0.75rem', fontWeight: 600, width: '100%',
                    }}
                  >
                    Buka Detail / Validasi
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
}
