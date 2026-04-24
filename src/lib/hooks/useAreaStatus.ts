'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AreaStatusLevel } from '@/types/database';

interface AreaStatusRow {
  region_id: string;
  status: AreaStatusLevel;
}

export function useAreaStatus(): Map<string, AreaStatusLevel> {
  const [areaStatusMap, setAreaStatusMap] = useState<Map<string, AreaStatusLevel>>(new Map());

  useEffect(() => {
    const supabase = createClient();

    const fetchAreaStatus = async () => {
      const { data } = await supabase
        .from('v_current_area_status')
        .select('region_id, status');

      if (data) {
        setAreaStatusMap(
          new Map((data as AreaStatusRow[]).map((row) => [row.region_id, row.status]))
        );
      }
    };

    fetchAreaStatus();

    const channel = supabase
      .channel('area-status-realtime-v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'area_status' }, () => {
        fetchAreaStatus();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return areaStatusMap;
}
