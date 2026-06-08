-- FR-021 (PBI-10) — RPC deteksi laporan duplikat berdekatan (PostGIS).
-- Mengembalikan true bila reporter yang sama sudah membuat laporan dalam radius
-- p_radius_meters & p_minutes_ago terakhir (status bukan rejected). Dipakai
-- submit route untuk menandai duplikat lokasi tanpa over-flagging.

CREATE OR REPLACE FUNCTION public.check_nearby_report(
  p_reporter_id uuid, p_lat double precision, p_lng double precision,
  p_radius_meters double precision, p_minutes_ago integer
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.reporter_id = p_reporter_id
      AND r.created_at >= now() - make_interval(mins => p_minutes_ago)
      AND r.status <> 'rejected'
      AND ST_DWithin(r.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_meters)
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_nearby_report(uuid, double precision, double precision, double precision, integer)
  TO authenticated, service_role, anon;
