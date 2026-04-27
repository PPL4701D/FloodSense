import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * FR-020: Credibility Score Calculation
 *
 * Formula:
 *   credibility_score =
 *     (upvotes - downvotes) * 0.3
 *   + verification_bonus * 0.5
 *   + completeness_score * 0.1
 *   + reporter_reputation * 0.1
 *
 * Called after vote changes or verification events.
 */

interface CompletenessFactors {
  has_photo: boolean;
  has_description: boolean;
  has_water_height: boolean;
  has_severity: boolean;
}

function computeCompleteness(factors: CompletenessFactors): number {
  let score = 0;
  if (factors.has_photo) score += 30;
  if (factors.has_description) score += 20;
  if (factors.has_water_height) score += 20;
  if (factors.has_severity) score += 30;
  return score;
}

function computeVerificationBonus(status: string): number {
  if (status === 'verified') return 50;
  if (status === 'rejected') return -50;
  return 0;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
    const supabase = await createClient();

    // 1. Fetch the report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, reporter_id, status, description, severity, water_height_cm')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // 2. Count votes
    const [upRes, downRes] = await Promise.all([
      supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('report_id', reportId)
        .eq('vote_type', 'upvote'),
      supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('report_id', reportId)
        .eq('vote_type', 'downvote'),
    ]);

    const upvotes = upRes.count ?? 0;
    const downvotes = downRes.count ?? 0;

    // 3. Check if report has photos
    const { count: photoCount } = await supabase
      .from('report_photos')
      .select('id', { count: 'exact', head: true })
      .eq('report_id', reportId);

    // 4. Get reporter reputation
    const { data: reporter } = await supabase
      .from('profiles')
      .select('reputation_score')
      .eq('id', report.reporter_id)
      .single();

    const reporterReputation = reporter?.reputation_score ?? 0;

    // 5. Compute score
    const voteComponent = (upvotes - downvotes) * 0.3;
    const verificationComponent = computeVerificationBonus(report.status) * 0.5;
    const completenessComponent =
      computeCompleteness({
        has_photo: (photoCount ?? 0) > 0,
        has_description: !!report.description && report.description.length > 0,
        has_water_height: report.water_height_cm !== null,
        has_severity: !!report.severity,
      }) * 0.1;
    const reputationComponent = reporterReputation * 0.1;

    const credibilityScore = parseFloat(
      (voteComponent + verificationComponent + completenessComponent + reputationComponent).toFixed(2)
    );

    // 6. Update report
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        credibility_score: credibilityScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update credibility score' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      credibility_score: credibilityScore,
      breakdown: {
        vote: voteComponent,
        verification: verificationComponent,
        completeness: completenessComponent,
        reputation: reputationComponent,
      },
    });
  } catch (err) {
    console.error('Credibility score error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
