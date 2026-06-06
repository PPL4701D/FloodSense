import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * FR-054 (PBI-29) — Region CRUD (item)
 *
 * PATCH  /api/admin/regions/[id] — ubah wilayah (admin only)
 * DELETE /api/admin/regions/[id] — hapus wilayah (admin only, dicegah bila punya
 *   wilayah anak atau laporan terkait).
 */

const LEVELS = ['provinsi', 'kabupaten', 'kecamatan'] as const;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: 'Unauthorized', status: 401 as const };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') return { error: 'Forbidden', status: 403 as const };
  return { user };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;

    const body = await req.json();
    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string') {
      const n = body.name.trim();
      if (!n) return NextResponse.json({ error: 'Nama tidak boleh kosong' }, { status: 400 });
      patch.name = n;
    }
    if (body.level !== undefined) {
      if (!LEVELS.includes(body.level)) return NextResponse.json({ error: 'Level tidak valid' }, { status: 400 });
      patch.level = body.level;
    }
    if (body.parent_id !== undefined) patch.parent_id = body.parent_id || null;
    if (body.code !== undefined) patch.code = (body.code ?? '').trim() || null;
    if (body.parent_id === id) return NextResponse.json({ error: 'Wilayah tidak boleh menjadi induk dirinya sendiri' }, { status: 400 });

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin.from('regions').update(patch).eq('id', id).select('id, name, level, parent_id, code').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from('audit_logs').insert({
      actor_id: auth.user.id, action: 'region_update', target_type: 'region', target_id: id, details: patch,
    });

    return NextResponse.json({ region: data });
  } catch (err) {
    console.error('PATCH /api/admin/regions/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;

    const admin = createAdminClient();

    // Guard: tidak boleh hapus bila punya wilayah anak
    const { count: childCount } = await admin.from('regions').select('id', { count: 'exact', head: true }).eq('parent_id', id);
    if ((childCount ?? 0) > 0) {
      return NextResponse.json({ error: `Tidak bisa dihapus: masih punya ${childCount} wilayah anak` }, { status: 409 });
    }
    // Guard: tidak boleh hapus bila ada laporan terkait
    const { count: reportCount } = await admin.from('reports').select('id', { count: 'exact', head: true }).eq('region_id', id);
    if ((reportCount ?? 0) > 0) {
      return NextResponse.json({ error: `Tidak bisa dihapus: terkait ${reportCount} laporan` }, { status: 409 });
    }

    const { error } = await admin.from('regions').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from('audit_logs').insert({
      actor_id: auth.user.id, action: 'region_delete', target_type: 'region', target_id: id, details: {},
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/regions/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
