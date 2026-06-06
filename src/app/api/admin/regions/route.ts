import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * FR-054 (PBI-29) — Manajemen Wilayah (Region CRUD) Admin
 *
 * GET  /api/admin/regions  — daftar semua wilayah (admin only)
 * POST /api/admin/regions  — buat wilayah baru (admin only)
 *   body: { name, level: 'provinsi'|'kabupaten'|'kecamatan', parent_id?, code? }
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

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('regions')
      .select('id, name, level, parent_id, code')
      .order('level', { ascending: true })
      .order('name', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ regions: data ?? [] });
  } catch (err) {
    console.error('GET /api/admin/regions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const name = (body.name ?? '').trim();
    const level = body.level;
    const parent_id = body.parent_id || null;
    const code = (body.code ?? '').trim() || null;

    if (!name) return NextResponse.json({ error: 'Nama wilayah wajib diisi' }, { status: 400 });
    if (!LEVELS.includes(level)) return NextResponse.json({ error: 'Level tidak valid' }, { status: 400 });
    if (level !== 'provinsi' && !parent_id) {
      return NextResponse.json({ error: 'Wilayah non-provinsi wajib memiliki induk' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('regions')
      .insert({ name, level, parent_id, code })
      .select('id, name, level, parent_id, code')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from('audit_logs').insert({
      actor_id: auth.user.id, action: 'region_create', target_type: 'region', target_id: data.id,
      details: { name, level },
    });

    return NextResponse.json({ region: data });
  } catch (err) {
    console.error('POST /api/admin/regions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
