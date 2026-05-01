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
      .select('id, full_name, role, reputation_score, avatar_url, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    // 3. Fetch auth users to get emails (service role has access to auth.admin)
    const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = new Map(
      (authData?.users ?? []).map((u) => [u.id, u.email ?? null])
    );

    // 4. Merge email into each profile
    const users = (profiles ?? []).map((p) => ({
      ...p,
      email: emailMap.get(p.id) ?? null,
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
    const { user_id, role } = body;

    if (!user_id || !role) {
      return NextResponse.json({ error: 'user_id and role are required' }, { status: 400 });
    }

    const validRoles = ['warga', 'staf', 'tlm', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Don't let admin change their own role
    if (user_id === user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    // Use admin client to bypass RLS when updating
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('profiles')
      .update({ role })
      .eq('id', user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'role_change',
      target_type: 'user',
      target_id: user_id,
      details: { new_role: role },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/admin/users error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
