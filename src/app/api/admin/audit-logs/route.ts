import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * FR-032 — GET /api/admin/audit-logs (admin only)
 *
 * Mengembalikan log aktivitas (append-only) dengan pagination + filter
 * action_type / actor / rentang tanggal. Nama actor di-merge dari profiles.
 */

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  try {
    // 1. Verify admin via session
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Parse filters
    const sp = req.nextUrl.searchParams;
    const page = Math.max(0, parseInt(sp.get('page') ?? '0', 10) || 0);
    const actionType = sp.get('action_type');
    const actorId = sp.get('actor_id');
    const from = sp.get('from');
    const to = sp.get('to');

    const admin = createAdminClient();
    let q = admin
      .from('audit_logs')
      .select('id, actor_id, action_type, target_type, target_id, delta, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (actionType) q = q.eq('action_type', actionType);
    if (actorId) q = q.eq('actor_id', actorId);
    if (from) q = q.gte('created_at', new Date(from + 'T00:00:00').toISOString());
    if (to) q = q.lte('created_at', new Date(to + 'T23:59:59').toISOString());

    const fromIdx = page * PAGE_SIZE;
    q = q.range(fromIdx, fromIdx + PAGE_SIZE - 1);

    const { data: logs, count, error } = await q;
    if (error) {
      console.error('Audit logs fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Merge actor names
    const actorIds = [...new Set((logs ?? []).map((l) => l.actor_id).filter(Boolean))];
    const nameMap = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name')
        .in('id', actorIds);
      (profiles ?? []).forEach((p) => nameMap.set(p.id, p.full_name));
    }

    const enriched = (logs ?? []).map((l) => ({
      ...l,
      actor_name: nameMap.get(l.actor_id) ?? 'Tidak diketahui',
    }));

    // Daftar actor unik (untuk filter "admin pelaku") — hanya saat halaman pertama.
    let actors: { id: string; name: string }[] | undefined;
    if (page === 0) {
      const { data: allActorRows } = await admin.from('audit_logs').select('actor_id');
      const uniqueActorIds = [...new Set((allActorRows ?? []).map((r) => r.actor_id).filter(Boolean))];
      const { data: actorProfiles } = uniqueActorIds.length
        ? await admin.from('profiles').select('id, full_name').in('id', uniqueActorIds)
        : { data: [] as { id: string; full_name: string }[] };
      actors = (actorProfiles ?? []).map((p) => ({ id: p.id, name: p.full_name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json({
      logs: enriched,
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      hasMore: (count ?? 0) > fromIdx + PAGE_SIZE,
      ...(actors ? { actors } : {}),
    });
  } catch (err) {
    console.error('GET /api/admin/audit-logs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
