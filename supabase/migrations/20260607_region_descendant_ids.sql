-- FR-054 — RPC wilayah turunan (rekursif) untuk filter hierarkis.
-- Diberi region_id, mengembalikan id wilayah itu + seluruh turunannya
-- (provinsi → kabupaten/kota → kecamatan). Dipakai dashboard, daftar laporan,
-- dan broadcast agar memilih satu wilayah otomatis mencakup anak-anaknya.

CREATE OR REPLACE FUNCTION public.region_descendant_ids(p_region uuid)
RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH RECURSIVE tree AS (
    SELECT r.id FROM public.regions r WHERE r.id = p_region
    UNION ALL
    SELECT c.id FROM public.regions c JOIN tree t ON c.parent_id = t.id
  )
  SELECT id FROM tree;
$$;

GRANT EXECUTE ON FUNCTION public.region_descendant_ids(uuid) TO anon, authenticated;
