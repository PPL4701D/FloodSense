'use client';

import { useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import type { HeatmapPoint } from '@/types/database';

interface HeatmapLayerProps {
  points: HeatmapPoint[];
  visible: boolean;
}

// Extend Leaflet types for heat plugin
declare module 'leaflet' {
  function heatLayer(
    latlngs: [number, number, number][],
    options?: {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      max?: number;
      minOpacity?: number;
      gradient?: Record<number, string>;
    }
  ): L.Layer & {
    setLatLngs: (latlngs: [number, number, number][]) => void;
    setOptions: (options: object) => void;
    redraw: () => void;
  };
}

type HeatLayer = L.Layer & {
  setLatLngs: (latlngs: [number, number, number][]) => void;
  setOptions: (options: object) => void;
  redraw: () => void;
};

/**
 * Map zoom level → heatmap pixel radius.
 * Small at low zoom (city/country view), larger at street level.
 * This prevents the heatmap from looking like a giant blob when zoomed out.
 */
function radiusForZoom(zoom: number): number {
  if (zoom <= 10) return 6;
  if (zoom <= 12) return 10;
  if (zoom <= 13) return 14;
  if (zoom <= 14) return 20;
  if (zoom <= 15) return 26;
  return 32; // zoom 16+
}

function blurForZoom(zoom: number): number {
  return Math.round(radiusForZoom(zoom) * 0.8);
}

export default function HeatmapLayer({ points, visible }: HeatmapLayerProps) {
  const map = useMap();
  const layerRef = useRef<HeatLayer | null>(null);

  function buildLayer(zoom: number): HeatLayer {
    return L.heatLayer(points, {
      radius: radiusForZoom(zoom),
      blur: blurForZoom(zoom),
      maxZoom: 18,
      max: 1.5, // require multiple points to reach max intensity (red)
      minOpacity: 0.15, // single points appear fainter/smaller
      gradient: {
        0.2: '#3b82f6',
        0.4: '#06b6d4',
        0.6: '#22c55e',
        0.8: '#eab308',
        1.0: '#ef4444',
      },
    });
  }

  function removeLayer() {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
  }

  // Rebuild layer when points or visibility changes
  useEffect(() => {
    removeLayer();
    if (!visible || points.length === 0) return;

    console.debug('[HeatmapLayer] rendering', points.length, 'points at zoom', map.getZoom());

    const layer = buildLayer(map.getZoom());
    layer.addTo(map);
    layerRef.current = layer;

    return () => { removeLayer(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, visible]);

  // Update radius on zoom change (without full rebuild)
  useMapEvents({
    zoomend: () => {
      if (!layerRef.current || !visible || points.length === 0) return;
      const zoom = map.getZoom();
      layerRef.current.setOptions({
        radius: radiusForZoom(zoom),
        blur: blurForZoom(zoom),
      });
      layerRef.current.redraw();
    },
  });

  return null;
}
