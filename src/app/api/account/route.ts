import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/**
 * FR-059 (PBI-34) — Manajemen Akun
 *
 * DELETE /api/account — hapus akun pengguna yang sedang login (beserta data
 *   terkait via cascade). Memakai service-role admin client. Mencatat ke audit_logs.
 */

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();

    // Catat sebelum dihapus
    await admin.from('audit_logs').insert({
      actor_id: user.id, action: 'account_delete', target_type: 'user', target_id: user.id, details: {},
    });

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error('account delete error:', delErr);
      return NextResponse.json({ error: 'Gagal menghapus akun' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/account error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
