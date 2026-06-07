-- FR-034 (PBI-17) — RPC wilayah leluhur (rekursif ke atas).
-- Diberi region_id, mengembalikan id wilayah itu + seluruh leluhurnya
-- (kecamatan → kabupaten/kota → provinsi). Dipakai email alert staf:
-- staf yang ber-assigned_region pada salah satu leluhur wilayah laporan
-- dianggap bertanggung jawab atas laporan tersebut.

CREATE OR REPLACE FUNCTION public.region_ancestor_ids(p_region uuid)
RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH RECURSIVE tree AS (
    SELECT r.id, r.parent_id FROM public.regions r WHERE r.id = p_region
    UNION ALL
    SELECT p.id, p.parent_id FROM public.regions p JOIN tree t ON p.id = t.parent_id
  )
  SELECT id FROM tree;
$$;

GRANT EXECUTE ON FUNCTION public.region_ancestor_ids(uuid) TO anon, authenticated, service_role;
