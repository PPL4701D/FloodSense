'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MapReport, SeverityLevel, ReportStatus, HeatmapPoint } from '@/types/database';
import { SEVERITY_WEIGHTS } from '@/types/database';

export interface MapFilters {
  severity: SeverityLevel | 'all';
  status: ReportStatus | 'all';
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
}

export interface MapLayerPreferences {
  showHeatmap: boolean;
  showClusters: boolean;
  showMarkers: boolean;
  baseLayer: 'dark' | 'osm' | 'satellite';
}

interface MapState {
  reports: MapReport[];
  heatmapPoints: HeatmapPoint[];
  activeFilters: MapFilters;
  layerPreferences: MapLayerPreferences;
  selectedReport: MapReport | null;
  isLoading: boolean;

  // Actions
  setReports: (reports: MapReport[]) => void;
  setSelectedReport: (report: MapReport | null) => void;
  setFilters: (filters: Partial<MapFilters>) => void;
  setLayerPreferences: (prefs: Partial<MapLayerPreferences>) => void;
  setLoading: (loading: boolean) => void;
}

function computeHeatmapPoints(reports: MapReport[]): HeatmapPoint[] {
  return reports
    .filter((r) => r.lat !== 0 && r.lng !== 0)
    .map((r) => [r.lat, r.lng, SEVERITY_WEIGHTS[r.severity]] as HeatmapPoint);
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      reports: [],
      heatmapPoints: [],
      activeFilters: {
        severity: 'all',
        status: 'all',
        timeRange: '7d',
      },
      layerPreferences: {
        showHeatmap: true,
        showClusters: false,
        showMarkers: true,
        baseLayer: 'dark',
      },
      selectedReport: null,
      isLoading: true,

      setReports: (reports) =>
        set({
          reports,
          heatmapPoints: computeHeatmapPoints(reports),
          isLoading: false,
        }),

      setSelectedReport: (report) => set({ selectedReport: report }),

      setFilters: (filters) =>
        set((state) => ({
          activeFilters: { ...state.activeFilters, ...filters },
        })),

      setLayerPreferences: (prefs) =>
        set((state) => ({
          layerPreferences: { ...state.layerPreferences, ...prefs },
        })),

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'floodsense-map-prefs',
      partialize: (state) => ({
        layerPreferences: state.layerPreferences,
        activeFilters: state.activeFilters,
      }),
    }
  )
);
