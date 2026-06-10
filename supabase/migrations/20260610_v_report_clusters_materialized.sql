-- FR-021a: Agregasi Spasial (ST_ClusterDBSCAN)
-- Menggantikan v_report_clusters lama dengan Materialized View

-- 1. Hapus view lama
DROP VIEW IF EXISTS public.v_report_clusters;

-- 2. Buat Materialized View baru
CREATE MATERIALIZED VIEW public.v_report_clusters AS
WITH clustered_reports AS (
  SELECT
    r.id,
    r.severity,
    r.status,
    r.created_at,
    r.location::geometry AS geom,
    -- ST_ClusterDBSCAN window function
    ST_ClusterDBSCAN(r.location::geometry, eps := 0.001, minpoints := 1) OVER () AS cluster_id
  FROM public.reports r
  WHERE r.created_at >= (now() - '7 days'::interval)
    AND r.status IN ('pending', 'verified', 'flagged')
)
SELECT
  cluster_id,
  count(*) AS report_count,
  ST_X(ST_Centroid(ST_Collect(geom))) AS center_lng,
  ST_Y(ST_Centroid(ST_Collect(geom))) AS center_lat,
  -- Ambil severity tertinggi di dalam cluster
  MAX(
    CASE severity
      WHEN 'sangat_berat' THEN 4
      WHEN 'berat' THEN 3
      WHEN 'sedang' THEN 2
      WHEN 'ringan' THEN 1
      ELSE 0
    END
  ) AS max_severity_score,
  MAX(created_at) AS latest_timestamp,
  BOOL_OR(status = 'verified') AS has_verified_report
FROM clustered_reports
WHERE cluster_id IS NOT NULL
GROUP BY cluster_id;

-- 3. Beri index unik untuk Materialized View agar bisa direfresh secara concurrent
CREATE UNIQUE INDEX IF NOT EXISTS idx_v_report_clusters_id ON public.v_report_clusters(cluster_id);

-- 4. Setup pg_cron untuk refresh setiap 5 menit
-- Memastikan pg_cron diaktifkan
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Menghapus schedule yang mungkin sudah ada agar tidak ganda (dengan aman)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_v_report_clusters_job') THEN
    PERFORM cron.unschedule('refresh_v_report_clusters_job');
  END IF;
END $$;

-- Mendaftarkan cron job
SELECT cron.schedule(
  'refresh_v_report_clusters_job',
  '*/5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_report_clusters$$
);
