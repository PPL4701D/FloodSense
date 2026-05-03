'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SEVERITY_LABELS, type ReportStatus, type SeverityLevel } from '@/types/database';
import {
  ChevronLeft, Droplets, MapPin, Clock, ArrowDown,
  Loader2, AlertCircle, Camera, CheckCircle2
} from 'lucide-react';
import dynamic from 'next/dynamic';
import VoteButtons from '@/components/reports/VoteButtons';

import WaveLoader from '@/components/ui/WaveLoader';

const MapViewer = dynamic(() => import('@/components/map/MapStaticViewer'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '200px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <WaveLoader size={48} />
    </div>
  )
});

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
  flagged: 'Ditandai',
  dalam_peninjauan: 'Sedang Ditinjau',
  moderated: 'Dimoderasi',
};

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  ringan: '#22c55e',
  sedang: '#eab308',
  berat: '#f97316',
  sangat_berat: '#ef4444',
};

type ReportDetail = {
  id: string;
  location: string;
  address: string | null;
  description: string | null;
  severity: SeverityLevel;
  water_height_cm: number | null;
  status: ReportStatus;
  is_surge_receding: boolean;
  created_at: string;
  report_photos: { storage_path: string }[];
};

import VerificationPanel from '@/components/reports/VerificationPanel';
import { useAuth } from '@/lib/hooks/useAuth';

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { role } = useAuth();
  
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [verificationPopup, setVerificationPopup] = useState<{ show: boolean, status: string } | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    if (!id) return;

    const fetchReport = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from('reports')
          .select('*, report_photos(storage_path)')
          .eq('id', id)
          .single();

        if (fetchErr) throw fetchErr;

        setReport(data as unknown as ReportDetail);

        // Fetch photo urls
        if (data.report_photos && data.report_photos.length > 0) {
          const urls = data.report_photos.map((p: any) => {
            const { data: { publicUrl } } = supabase.storage
              .from('flood-photos')
              .getPublicUrl(p.storage_path);
            return publicUrl;
          });
          setPhotoUrls(urls);
        }
      } catch (err: unknown) {
        console.error('Failed to load report:', err);
        setError('Gagal memuat detail laporan. Laporan mungkin sudah dihapus atau ID tidak valid.');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Parse location - handles WKT "POINT(lng lat)" and WKB hex from PostGIS
  const parseLocation = (locStr: string) => {
    if (!locStr) return { lat: 0, lng: 0 };
    try {
      // WKT format: "POINT(lng lat)" or "SRID=4326;POINT(lng lat)"
      const wktMatch = locStr.match(/POINT\(([^ ]+) ([^)]+)\)/);
      if (wktMatch) {
        return { lng: parseFloat(wktMatch[1]), lat: parseFloat(wktMatch[2]) };
      }
      // WKB hex format from PostGIS - decode x/y as little-endian doubles
      if (/^[0-9A-Fa-f]+$/.test(locStr) && locStr.length >= 42) {
        const byteOrder = parseInt(locStr.slice(0, 2), 16); // 01 = little-endian
        const hasSrid = locStr.length >= 50 && locStr.slice(8, 10) === '20';
        const offset = hasSrid ? 9 : 5; // 9 bytes if has SRID, 5 bytes if not
        if (byteOrder === 1) {
          const readDouble = (h: string, pos: number) => {
            const bytes = [];
            for (let i = 0; i < 8; i++) bytes.push(parseInt(h.slice(pos + i * 2, pos + i * 2 + 2), 16));
            const buf = new Uint8Array(bytes).buffer;
            return new DataView(buf).getFloat64(0, true);
          };
          const x = readDouble(locStr, offset * 2);
          const y = readDouble(locStr, offset * 2 + 16);
          if (isFinite(x) && isFinite(y) && (x !== 0 || y !== 0)) {
            return { lng: x, lat: y };
          }
        }
      }
    } catch (e) {
      console.warn('parseLocation error:', e);
    }
    return { lat: 0, lng: 0 };
  };


  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <WaveLoader size={48} />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', padding: '1rem' }}>
        <div className="glass" style={{
          padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
          borderBottom: '1px solid rgba(51,65,85,0.5)', marginBottom: '2rem'
        }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}>
            <ChevronLeft size={20} color="var(--text-primary)" />
          </button>
          <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>Kembali</h1>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>{error || 'Laporan tidak ditemukan'}</p>
        </div>
      </div>
    );
  }

  const { lat, lng } = parseLocation(report.location);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="glass" style={{
        position: 'sticky', top: 0, zIndex: 100, padding: '0.75rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        borderBottom: '1px solid rgba(51,65,85,0.5)'
      }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}>
          <ChevronLeft size={20} color="var(--text-primary)" />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>Detail Laporan</h1>
        </div>
      </div>

      <div style={{ padding: '1rem', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Status Card */}
        <div className="card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px',
            background: report.status === 'verified' ? '#22c55e' : (report.status === 'pending' || report.status === 'dalam_peninjauan' ? '#eab308' : '#ef4444')
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Status Laporan</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {report.status === 'verified' && <CheckCircle2 size={16} color="#22c55e" />}
                <p style={{
                  fontSize: '1rem', fontWeight: 700,
                  color: report.status === 'verified' ? '#22c55e' : (report.status === 'pending' || report.status === 'dalam_peninjauan' ? '#eab308' : '#ef4444')
                }}>
                  {STATUS_LABELS[report.status]}
                </p>
              </div>
            </div>
            <div className={`badge badge-severity-${report.severity}`} style={{ fontSize: '0.75rem' }}>
              <Droplets size={12} /> {SEVERITY_LABELS[report.severity]}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Clock size={14} />
              <span> Dilaporkan pada {new Date(report.created_at).toLocaleString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}</span>
            </div>
          </div>
          
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(51,65,85,0.5)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Bantu validasi laporan ini:</p>
            <VoteButtons reportId={report.id} />
          </div>
        </div>

        {/* Photos (if any) */}
        {photoUrls.length > 0 && (
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Camera size={16} color="var(--primary-400)" /> Bukti Foto Terlampir
            </h3>
            <div style={{ display: 'flex', overflowX: 'auto', gap: '0.75rem', paddingBottom: '0.5rem', scrollSnapType: 'x mandatory' }}>
              {photoUrls.map((url, i) => (
                <div key={i} style={{
                  flex: '0 0 auto', width: '200px', height: '140px',
                  borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  scrollSnapAlign: 'start', position: 'relative',
                  border: '1px solid var(--border-primary)'
                }}>
                  <img src={url} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Details Data */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {report.water_height_cm && (
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Ketinggian Air</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowDown size={16} color="var(--primary-400)" />
                <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{report.water_height_cm} cm</p>
              </div>
            </div>
          )}
          
          {report.is_surge_receding && (
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(34,197,94,0.1)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <ArrowDown size={16} color="#22c55e" />
              <p style={{ fontSize: '0.8125rem', color: '#22c55e', fontWeight: 500 }}>Tinggi air mulai surut</p>
            </div>
          )}

          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Keterangan / Deskripsi</p>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.5, color: report.description ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {report.description || 'Tidak ada keterangan tambahan dari pelapor.'}
            </p>
          </div>
        </div>

        {/* Location Map */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={16} color="var(--primary-400)" /> Lokasi
          </h3>
          
          {report.address && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.4 }}>
              {report.address}
            </p>
          )}

          <div style={{ height: '200px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
            <MapViewer lat={lat} lng={lng} />
          </div>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
            Koordinat: {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
        </div>

        {/* Verification Panel for Staff/Admin/TLM */}
        {(role === 'staf' || role === 'admin' || role === 'tlm') && (
          <VerificationPanel 
            reportId={report.id} 
            onSuccess={(decision) => {
              // Optimistic UI update without reloading
              let reportStatus = decision as string;
              if (decision === 'scheduled_check') reportStatus = 'dalam_peninjauan';
              
              setReport(prev => prev ? { 
                ...prev, 
                status: reportStatus as ReportDetail['status'],
                verified_by: 'me', // Optimistic mock
                verified_at: new Date().toISOString()
              } : null);
              
              setVerificationPopup({ show: true, status: reportStatus });
            }} 
          />
        )}

      </div>

      {/* Verification Success Popup */}
      {verificationPopup?.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem', animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="card" style={{
            maxWidth: '400px', width: '100%', padding: '2rem 1.5rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', background: 'var(--bg-elevated)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
            transform: 'scale(1)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem'
            }}>
              <CheckCircle2 size={32} color="#22c55e" />
            </div>
            
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Laporan Berhasil Diverifikasi
            </h2>
            
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Status pelaporan ini telah diperbarui menjadi:
              <br />
              <strong style={{ 
                display: 'inline-block', marginTop: '0.5rem', padding: '0.25rem 0.75rem', 
                borderRadius: 'var(--radius-full)', background: 'var(--bg-primary)', 
                color: 'var(--primary-400)', border: '1px solid var(--border-primary)' 
              }}>
                {STATUS_LABELS[verificationPopup.status as ReportStatus] || verificationPopup.status}
              </strong>
            </p>
            
            <button 
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => setVerificationPopup(null)}
            >
              Tutup & Lanjutkan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
