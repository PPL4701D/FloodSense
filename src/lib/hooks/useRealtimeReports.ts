'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useMapStore } from '@/stores/mapStore';
import type { MapReport, SeverityLevel, ReportStatus } from '@/types/database';

const TIME_RANGES = {
  '1h': 1 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

/**
 * Parse a location value that may be:
 *  - a GeoJSON object:  { type: "Point", coordinates: [lng, lat] }
 *  - a hex WKB string:  "0101000020E610000..."  (PostgREST raw geometry)
 *  - null / undefined
 *
 * For hex WKB we fall back to [0, 0] so corrupt rows are filtered out later.
 */
function parseLocation(raw: unknown): { lat: number; lng: number } {
  if (!raw) return { lat: 0, lng: 0 };

  // Already a GeoJSON object
  if (typeof raw === 'object') {
    const geo = raw as { type?: string; coordinates?: number[] };
    if (geo.type === 'Point' && Array.isArray(geo.coordinates)) {
      return {
        lng: geo.coordinates[0],
        lat: geo.coordinates[1],
      };
    }
  }

  // Hex WKB string — cannot parse on client without extra library.
  // We'll fix this at the DB query level instead (see RPC below).
  return { lat: 0, lng: 0 };
}

export function useRealtimeReports() {
  const { activeFilters, setReports, setLoading } = useMapStore();
  const supabase = createClient();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const sinceDate = new Date(Date.now() - TIME_RANGES[activeFilters.timeRange]).toISOString();

      const { data, error } = await supabase.rpc('get_map_reports', {
        p_since: sinceDate,
        p_severity: activeFilters.severity === 'all' ? null : activeFilters.severity,
        p_status: activeFilters.status === 'all' ? null : activeFilters.status,
      });

      if (error) {
        console.warn('[useRealtimeReports] RPC failed, falling back to direct select:', error.message);
        await fallbackFetch(sinceDate);
        return;
      }

      const mapped: MapReport[] = (data as RpcRow[] | null ?? []).map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        severity: r.severity,
        status: r.status,
        water_height_cm: r.water_height_cm,
        created_at: r.created_at,
        description: r.description,
        photo_url: r.photo_url ?? null,
        region_id: r.region_id,
      }));
      setReports(mapped);
    } catch (err) {
      console.error('[useRealtimeReports] unexpected error:', err);
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  // Plain-select fallback when RPC not yet deployed
  interface FallbackRow {
    id: string;
    location: unknown;
    severity: SeverityLevel;
    status: ReportStatus;
    water_height_cm: number | null;
    created_at: string;
    description: string | null;
    region_id: string | null;
  }

  async function fallbackFetch(sinceDate: string) {
    let query = supabase
      .from('reports')
      .select(`id, location, severity, status, water_height_cm, created_at, description, region_id`)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(500);

    if (activeFilters.severity !== 'all') query = query.eq('severity', activeFilters.severity);
    if (activeFilters.status !== 'all') {
      query = query.eq('status', activeFilters.status);
    } else {
      query = query.in('status', ['pending', 'verified']);
    }

    const { data, error } = await query;
    if (error) { console.error('[useRealtimeReports] fallback error:', error); setLoading(false); return; }

    const mapped: MapReport[] = (data as FallbackRow[] | null ?? []).map((r) => {
      const { lat, lng } = parseLocation(r.location);
      return {
        id: r.id,
        lat,
        lng,
        severity: r.severity,
        status: r.status,
        water_height_cm: r.water_height_cm,
        created_at: r.created_at,
        description: r.description,
        photo_url: null,
        region_id: r.region_id,
      };
    });
    console.debug('[useRealtimeReports] fallback loaded', mapped.length, 'reports (coords may be 0,0 if WKB)');
    setReports(mapped);
  }

  // Initial fetch
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('reports-realtime-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        fetchReports();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchReports]);

  return { refetch: fetchReports };
}

// ---- Types for the RPC response ----
interface RpcRow {
  id: string;
  lat: number;
  lng: number;
  severity: MapReport['severity'];
  status: MapReport['status'];
  water_height_cm: number | null;
  created_at: string;
  description: string | null;
  photo_url: string | null;
  region_id: string | null;
}
