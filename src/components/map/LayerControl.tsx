'use client';

import { useState } from 'react';
import { Layers, Map as MapIcon, Satellite, Moon, Eye, EyeOff, Flame, Grid3x3 } from 'lucide-react';
import type { MapLayerPreferences } from '@/stores/mapStore';

interface LayerControlProps {
  preferences: MapLayerPreferences;
  onChange: (prefs: Partial<MapLayerPreferences>) => void;
}

const BASE_LAYERS: { key: MapLayerPreferences['baseLayer']; label: string; icon: typeof MapIcon }[] = [
  { key: 'dark', label: 'Gelap', icon: Moon },
  { key: 'osm', label: 'Peta', icon: MapIcon },
  { key: 'satellite', label: 'Satelit', icon: Satellite },
];

export default function LayerControl({ preferences, onChange }: LayerControlProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{
      position: 'absolute', top: '16px', left: '16px', zIndex: 1000,
    }}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Layer"
        style={{
          width: '44px', height: '44px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-md)',
          transition: 'all var(--transition-fast)',
        }}
      >
        <Layers size={18} color={isOpen ? 'var(--primary-400)' : 'var(--text-secondary)'} />
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute', top: '52px', left: 0,
            width: '200px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: '0.75rem',
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
          }}
        >
          {/* Base Layers */}
          <div>
            <p style={{
              fontSize: '0.625rem', fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.375rem',
            }}>
              Peta Dasar
            </p>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {BASE_LAYERS.map((layer) => {
                const Icon = layer.icon;
                const isActive = preferences.baseLayer === layer.key;
                return (
                  <button
                    key={layer.key}
                    onClick={() => onChange({ baseLayer: layer.key })}
                    style={{
                      flex: 1,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: '4px',
                      padding: '8px 4px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${isActive ? 'var(--primary-500)' : 'var(--border-primary)'}`,
                      background: isActive ? 'rgba(59,130,246,0.1)' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <Icon size={14} color={isActive ? 'var(--primary-400)' : 'var(--text-muted)'} />
                    <span style={{
                      fontSize: '0.5625rem', fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--primary-400)' : 'var(--text-muted)',
                    }}>
                      {layer.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Separator */}
          <div style={{ height: '1px', background: 'var(--border-primary)' }} />

          {/* Overlay Toggles */}
          <div>
            <p style={{
              fontSize: '0.625rem', fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.375rem',
            }}>
              Overlay
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {/* Heatmap Toggle */}
              <button
                onClick={() => onChange({ showHeatmap: !preferences.showHeatmap })}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'none', cursor: 'pointer',
                  width: '100%',
                }}
              >
                <Flame size={14} color={preferences.showHeatmap ? '#f97316' : 'var(--text-muted)'} />
                <span style={{
                  flex: 1, textAlign: 'left',
                  fontSize: '0.75rem', fontWeight: 500,
                  color: preferences.showHeatmap ? 'var(--text-primary)' : 'var(--text-muted)',
                }}>
                  Heatmap
                </span>
                {preferences.showHeatmap ?
                  <Eye size={12} color="var(--primary-400)" /> :
                  <EyeOff size={12} color="var(--text-muted)" />
                }
              </button>

              {/* Cluster Toggle */}
              <button
                onClick={() => onChange({ showClusters: !preferences.showClusters })}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'none', cursor: 'pointer',
                  width: '100%',
                }}
              >
                <Grid3x3 size={14} color={preferences.showClusters ? '#3b82f6' : 'var(--text-muted)'} />
                <span style={{
                  flex: 1, textAlign: 'left',
                  fontSize: '0.75rem', fontWeight: 500,
                  color: preferences.showClusters ? 'var(--text-primary)' : 'var(--text-muted)',
                }}>
                  Cluster
                </span>
                {preferences.showClusters ?
                  <Eye size={12} color="var(--primary-400)" /> :
                  <EyeOff size={12} color="var(--text-muted)" />
                }
              </button>

              {/* Markers Toggle */}
              <button
                onClick={() => onChange({ showMarkers: !preferences.showMarkers })}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'none', cursor: 'pointer',
                  width: '100%',
                }}
              >
                <MapIcon size={14} color={preferences.showMarkers ? '#22c55e' : 'var(--text-muted)'} />
                <span style={{
                  flex: 1, textAlign: 'left',
                  fontSize: '0.75rem', fontWeight: 500,
                  color: preferences.showMarkers ? 'var(--text-primary)' : 'var(--text-muted)',
                }}>
                  Penanda
                </span>
                {preferences.showMarkers ?
                  <Eye size={12} color="var(--primary-400)" /> :
                  <EyeOff size={12} color="var(--text-muted)" />
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
