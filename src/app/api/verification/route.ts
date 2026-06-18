import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check staff role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['staf', 'tlm', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { report_id, decision, notes, scheduled_check_at } = body;

    if (!report_id || !decision) {
      return NextResponse.json(
        { error: 'report_id and decision are required' },
        { status: 400 }
      );
    }

    if (!['verified', 'rejected', 'scheduled_check'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision' },
        { status: 400 }
      );
    }

    let scheduledCheckAt: string | null = null;
    if (decision === 'scheduled_check') {
      if (!scheduled_check_at) {
        return NextResponse.json(
          { error: 'scheduled_check_at is required for scheduled checks' },
          { status: 400 }
        );
      }

      const scheduledDate = new Date(scheduled_check_at);
      if (Number.isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid scheduled_check_at' },
          { status: 400 }
        );
      }

      scheduledCheckAt = scheduledDate.toISOString();
    }

    let reportStatus = decision;
    if (decision === 'scheduled_check') reportStatus = 'dalam_peninjauan';

    // Update the report
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        status: reportStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', report_id);

    if (updateError) {
      console.error('Verification update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      );
    }

    // Insert verification log
    await supabase.from('verifications').insert({
      report_id,
      staff_id: user.id,
      decision,
      notes: notes || '',
      scheduled_check_at: scheduledCheckAt,
    });

    // Update reporter reputation (FR-020)
    const { data: report } = await supabase
      .from('reports')
      .select('reporter_id, address')
      .eq('id', report_id)
      .single();

    if (report) {
      const reputationDelta = decision === 'verified' ? 1 : decision === 'rejected' ? -1 : 0;
      if (reputationDelta !== 0) {
        // Pakai ADMIN client (service role): menambah reputasi PELAPOR (bukan profil staf
        // sendiri) tak boleh terblok RLS. Catatan: RPC increment_reputation tidak tersedia,
        // dan supabase-js TIDAK melempar error saat RPC gagal — sehingga fallback lama tak
        // pernah berjalan. Di sini langsung baca-tulis via service role + cek error.
        const admin = createAdminClient();
        const { data: profile, error: readErr } = await admin
          .from('profiles')
          .select('reputation_score')
          .eq('id', report.reporter_id)
          .single();
        if (readErr) {
          console.error('Gagal membaca reputasi pelapor:', readErr.message);
        } else if (profile) {
          const current = (profile as { reputation_score: number | null }).reputation_score ?? 0;
          const { error: updErr } = await admin
            .from('profiles')
            .update({ reputation_score: current + reputationDelta })
            .eq('id', report.reporter_id);
          if (updErr) console.error('Gagal update reputasi pelapor:', updErr.message);
        }
      }
    }

    // Recalculate credibility score (FR-020)
    const baseUrl = req.nextUrl.origin;
    fetch(`${baseUrl}/api/reports/${report_id}/credibility`, { method: 'POST' }).catch(() => {});

    // FR-022: Notify reporter of status change
    if (report && (decision === 'verified' || decision === 'rejected')) {
      const addressText = report.address ? ` di ${report.address}` : '';
      const notifType = decision === 'verified' ? 'report_verified' : 'report_rejected';
      const notifTitle = decision === 'verified'
        ? 'Laporan Anda Terverifikasi'
        : 'Laporan Anda Ditolak';
      const notifBody = decision === 'verified'
        ? `Laporan banjir Anda${addressText} telah diverifikasi oleh petugas.`
        : `Laporan banjir Anda${addressText} ditolak. Alasan: ${notes || 'Tidak sesuai kondisi lapangan.'}`;

      await supabase.from('notifications').insert({
        user_id: report.reporter_id,
        type: notifType,
        title: notifTitle,
        body: notifBody,
        related_report_id: report_id,
      });
    }

    // FR-032: Audit log
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action_type: decision === 'verified' ? 'REPORT_VERIFY' : decision === 'rejected' ? 'REPORT_REJECT' : 'REPORT_SCHEDULE_CHECK',
      target_type: 'report',
      target_id: report_id,
      delta: { decision, notes: notes || null, scheduled_check_at: scheduledCheckAt },
    });

    return NextResponse.json({ success: true, decision });
  } catch (err) {
    console.error('Verification API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
