import { createClient } from '@/lib/supabase/server';
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
    const { report_id, decision, notes } = body;

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
    });

    // Update reporter reputation (FR-020)
    const { data: report } = await supabase
      .from('reports')
      .select('reporter_id')
      .eq('id', report_id)
      .single();

    if (report) {
      const reputationDelta = decision === 'verified' ? 1 : decision === 'rejected' ? -1 : 0;
      if (reputationDelta !== 0) {
        try {
          await supabase.rpc('increment_reputation', {
            user_id: report.reporter_id,
            delta: reputationDelta,
          });
        } catch {
          // Fallback: direct update if RPC not available
          const { data: profile } = await supabase
            .from('profiles')
            .select('reputation_score')
            .eq('id', report.reporter_id)
            .single();
          if (profile) {
            await supabase
              .from('profiles')
              .update({ reputation_score: ((profile as Record<string, unknown>).reputation_score as number || 0) + reputationDelta })
              .eq('id', report.reporter_id);
          }
        }
      }
    }

    // Recalculate credibility score (FR-020)
    const baseUrl = req.nextUrl.origin;
    fetch(`${baseUrl}/api/reports/${report_id}/credibility`, { method: 'POST' }).catch(() => {});

    // FR-022: Notify reporter of status change
    if (report && (decision === 'verified' || decision === 'rejected')) {
      const notifType = decision === 'verified' ? 'report_verified' : 'report_rejected';
      const notifTitle = decision === 'verified'
        ? 'Laporan Anda Terverifikasi'
        : 'Laporan Anda Ditolak';
      const notifBody = decision === 'verified'
        ? 'Laporan banjir Anda telah diverifikasi oleh petugas.'
        : `Laporan banjir Anda ditolak. Alasan: ${notes || 'Tidak sesuai kondisi lapangan.'}`;

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
      delta: { decision, notes: notes || null },
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
