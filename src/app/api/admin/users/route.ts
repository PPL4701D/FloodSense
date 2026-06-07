import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/users — List all users (admin only)
 * PATCH /api/admin/users — Update user role (admin only)
 */

export async function GET() {
  try {
    // 1. Verify the requesting user is an admin (using their session cookie)
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: requestingProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!requestingProfile || requestingProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Use service-role admin client to bypass RLS and fetch all profiles
    const adminClient = createAdminClient();

    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, full_name, role, reputation_score, avatar_url, created_at, assigned_region_id')
      .order('created_at', { ascending: false });

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    // 3. Fetch auth users to get emails (service role has access to auth.admin)
    const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = new Map(
      (authData?.users ?? []).map((u) => [u.id, u.email ?? null])
    );

    // 3b. Nama wilayah tugas (assigned_region) untuk ditampilkan di UI.
    const regionIds = Array.from(new Set((profiles ?? []).map((p) => p.assigned_region_id).filter(Boolean)));
    const regionNameMap = new Map<string, string>();
    if (regionIds.length > 0) {
      const { data: regs } = await adminClient.from('regions').select('id, name').in('id', regionIds as string[]);
      (regs ?? []).forEach((r) => regionNameMap.set(r.id, r.name));
    }

    // 4. Merge email + nama wilayah tugas into each profile
    const users = (profiles ?? []).map((p) => ({
      ...p,
      email: emailMap.get(p.id) ?? null,
      assigned_region_name: p.assigned_region_id ? (regionNameMap.get(p.assigned_region_id) ?? null) : null,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error('GET /api/admin/users error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, role, assigned_region_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id wajib diisi' }, { status: 400 });
    }
    if (role === undefined && assigned_region_id === undefined) {
      return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 });
    }

    const validRoles = ['warga', 'staf', 'tlm', 'admin'];
    if (role !== undefined && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Don't let admin change their own role
    if (user_id === user.id && role !== undefined) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    // FR-034: assigned_region_id menentukan area tanggung jawab staf (untuk email alert).
    const patch: Record<string, unknown> = {};
    if (role !== undefined) patch.role = role;
    if (assigned_region_id !== undefined) patch.assigned_region_id = assigned_region_id || null;

    // Use admin client to bypass RLS when updating
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('profiles')
      .update(patch)
      .eq('id', user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'user_update',
      target_type: 'user',
      target_id: user_id,
      details: patch,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/admin/users error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
