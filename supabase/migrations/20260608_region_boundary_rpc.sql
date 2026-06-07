-- FR-054 (PBI-29) — RPC baca/tulis boundary wilayah (GeoJSON ↔ PostGIS).
-- Dipakai editor boundary admin (/admin/regions). Kolom regions.boundary
-- bertipe geography(MultiPolygon,4326); Polygon dipromosikan via ST_Multi.

CREATE OR REPLACE FUNCTION public.get_region_boundary(p_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ST_AsGeoJSON(boundary::geometry) FROM public.regions WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.set_region_boundary(p_id uuid, p_geojson text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_geojson IS NULL OR length(btrim(p_geojson)) = 0 THEN
    UPDATE public.regions SET boundary = NULL WHERE id = p_id;
  ELSE
    UPDATE public.regions
    SET boundary = ST_Multi(ST_GeomFromGeoJSON(p_geojson))::geography
    WHERE id = p_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_region_boundary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_region_boundary(uuid, text) TO authenticated, service_role;
