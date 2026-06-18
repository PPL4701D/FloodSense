/**
 * FR-034 (PBI-17) — Email Alert via Resend
 *
 * Helper pengiriman email memakai Resend HTTP API (tanpa SDK). Dipakai untuk
 * memberi tahu staf/TLM/admin saat ada laporan banjir baru masuk. Best-effort:
 * mengembalikan status tanpa melempar error agar tidak memblokir alur utama.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM = process.env.RESEND_FROM || 'FloodSense <onboarding@resend.dev>';

// Domain test Resend (onboarding@resend.dev) hanya boleh mengirim ke alamat pemilik
// akun. Selama domain belum diverifikasi, set RESEND_TEST_RECIPIENT ke email pemilik
// akun → seluruh alert dialihkan ke alamat itu agar pengiriman tetap berhasil.
// Untuk produksi: verifikasi domain, set RESEND_FROM ke domain itu, dan KOSONGKAN
// RESEND_TEST_RECIPIENT agar email terkirim ke penerima asli.
const TEST_RECIPIENT = process.env.RESEND_TEST_RECIPIENT;

export interface SendResult { ok: boolean; skipped?: boolean; status?: number; error?: string }

export async function sendEmail(to: string[], subject: string, html: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, error: 'RESEND_API_KEY tidak diset' };
  if (!to || to.length === 0) return { ok: false, skipped: true, error: 'Tidak ada penerima' };
  const recipients = TEST_RECIPIENT ? [TEST_RECIPIENT] : to;
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: recipients, subject, html }),
      signal: AbortSignal.timeout(8000), // jangan menggantung bila Resend lambat
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, status: res.status, error: t.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const SEVERITY_LABEL: Record<string, string> = {
  ringan: 'Ringan', sedang: 'Sedang', berat: 'Berat', sangat_berat: 'Sangat Berat',
};

/** Susun konten email peringatan laporan banjir baru untuk staf. */
export function buildNewReportEmail(params: {
  severity: string; address: string | null; waterHeight: number | null;
  description: string | null; reportUrl: string;
}): { subject: string; html: string } {
  const sev = SEVERITY_LABEL[params.severity] ?? params.severity;
  const subject = `🚨 Laporan Banjir Baru (${sev}) — Perlu Verifikasi`;
  const html = `
  <div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden">
    <div style="background:#ef4444;height:6px"></div>
    <div style="padding:24px">
      <h2 style="margin:0 0 4px;font-size:18px">🌊 FloodSense — Laporan Banjir Baru</h2>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px">Ada laporan banjir baru yang memerlukan verifikasi staf.</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#94a3b8">Tingkat</td><td style="padding:6px 0;font-weight:700">${sev}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8">Lokasi</td><td style="padding:6px 0">${params.address ?? '-'}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8">Ketinggian</td><td style="padding:6px 0">${params.waterHeight != null ? params.waterHeight + ' cm' : '-'}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;vertical-align:top">Keterangan</td><td style="padding:6px 0">${params.description ?? '-'}</td></tr>
      </table>
      <a href="${params.reportUrl}" style="display:inline-block;margin-top:18px;background:#3b82f6;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px">Buka & Verifikasi Laporan</a>
    </div>
  </div>`;
  return { subject, html };
}
