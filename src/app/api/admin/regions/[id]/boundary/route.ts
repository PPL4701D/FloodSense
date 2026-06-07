import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * FR-054 (PBI-29) — Boundary wilayah (GeoJSON / PostGIS).
 *
 * GET /api/admin/regions/[id]/boundary  → { geojson: Polygon|MultiPolygon|null }
 * PUT /api/admin/regions/[id]/boundary  → simpan boundary (admin only)
 *   body: { geojson: <GeoJSON geometry|Feature|null> }  (null = hapus boundary)
 *
 * Disimpan ke kolom regions.boundary (geography MultiPolygon,4326) via RPC
 * set_region_boundary. Boundary dipakai trigger auto_assign_region (ST_Intersects)
 * sehingga laporan baru otomatis ter-tag wilayah berdasarkan lokasi.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: 'Unauthorized', status: 401 as const };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') return { error: 'Forbidden', status: 403 as const };
  return { user };
}

interface GeoJSONGeometry { type: string; coordinates?: unknown; geometry?: GeoJSONGeometry; features?: Array<{ geometry?: GeoJSONGeometry }> }

/** Ekstrak geometry Polygon/MultiPolygon dari geometry/Feature/FeatureCollection. */
function extractGeometry(input: GeoJSONGeometry | null): GeoJSONGeometry | null {
  if (!input || typeof input !== 'object') return null;
  if (input.type === 'Feature' && input.geometry) return extractGeometry(input.geometry);
  if (input.type === 'FeatureCollection') return extractGeometry(input.features?.[0]?.geometry ?? null);
  if (input.type === 'Polygon' || input.type === 'MultiPolygon') return input;
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('get_region_boundary', { p_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ geojson: data ? JSON.parse(data as string) : null });
  } catch (err) {
    console.error('GET boundary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;

    const body = await req.json();
    const admin = createAdminClient();

    // Hapus boundary
    if (body.geojson == null) {
      const { error } = await admin.rpc('set_region_boundary', { p_id: id, p_geojson: null });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const geom = extractGeometry(body.geojson);
      if (!geom) return NextResponse.json({ error: 'GeoJSON harus berupa Polygon/MultiPolygon' }, { status: 400 });
      const { error } = await admin.rpc('set_region_boundary', { p_id: id, p_geojson: JSON.stringify(geom) });
      if (error) return NextResponse.json({ error: `GeoJSON tidak valid: ${error.message}` }, { status: 400 });
    }

    await admin.from('audit_logs').insert({
      actor_id: auth.user.id, action: 'region_boundary_update', target_type: 'region', target_id: id,
      details: { cleared: body.geojson == null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PUT boundary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
