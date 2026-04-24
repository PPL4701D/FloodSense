import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AreaStatusLevel } from '@/types/database';

const VALID_STATUSES: AreaStatusLevel[] = ['normal', 'waspada', 'siaga', 'banjir_aktif', 'mereda'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['staf', 'admin'].includes(profile.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden: hanya staf atau admin' }, { status: 403 });
  }

  let body: { region_id?: string; status?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Body tidak valid' }, { status: 400 });
  }

  const { region_id, status, note } = body;

  if (!region_id || typeof region_id !== 'string') {
    return NextResponse.json({ success: false, error: 'region_id wajib diisi' }, { status: 400 });
  }
  if (!status || !VALID_STATUSES.includes(status as AreaStatusLevel)) {
    return NextResponse.json({ success: false, error: `status harus salah satu: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }
  if (!note || note.trim().length < 20) {
    return NextResponse.json({ success: false, error: 'Catatan minimal 20 karakter' }, { status: 400 });
  }

  // Close current active area_status for this region (append-only pattern)
  await supabase
    .from('area_status')
    .update({ valid_until: new Date().toISOString() })
    .eq('region_id', region_id)
    .is('valid_until', null);

  // Insert new record
  const { data: newRecord, error: insertError } = await supabase
    .from('area_status')
    .insert({
      region_id,
      status: status as AreaStatusLevel,
      trigger_type: 'manual',
      requires_confirmation: false,
      confirmed_by: user.id,
      note: note.trim(),
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: newRecord });
}
