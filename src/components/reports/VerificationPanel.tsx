'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Search, Loader2, Send } from 'lucide-react';
import type { VerificationDecision } from '@/types/database';

interface VerificationPanelProps {
  reportId: string;
  onSuccess?: (decision: VerificationDecision) => void;
}

export default function VerificationPanel({ reportId, onSuccess }: VerificationPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<VerificationDecision>('verified');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!notes.trim() && decision !== 'verified') {
      setError('Catatan wajib diisi jika menolak atau membedwalkan peninjauan laporan.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, decision, notes }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify');
      }
      
      // Fast refresh
      router.refresh();
      onSuccess?.(decision);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  const getButtonBg = () => {
    if (decision === 'verified') return 'linear-gradient(135deg, #22c55e, #16a34a)';
    if (decision === 'rejected') return 'linear-gradient(135deg, #ef4444, #dc2626)';
    return 'linear-gradient(135deg, #eab308, #ca8a04)';
  };

  return (
    <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--primary-500)', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.15)' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary-400)' }}>
        Panel Verifikasi & Moderasi Staf
      </h3>
      
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '0.5rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setDecision('verified')}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
            padding: '0.75rem 0.5rem', borderRadius: 'var(--radius-sm)',
            border: `1px solid ${decision === 'verified' ? '#22c55e' : 'var(--border-primary)'}`,
            background: decision === 'verified' ? 'rgba(34,197,94,0.1)' : 'var(--bg-elevated)',
            color: decision === 'verified' ? '#22c55e' : 'var(--text-secondary)',
            transition: 'all 0.2s ease', cursor: 'pointer',
            boxShadow: decision === 'verified' ? '0 0 10px rgba(34,197,94,0.2)' : 'none'
          }}
        >
          <CheckCircle size={18} />
          <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>Setujui Laporan</span>
        </button>
        
        <button
          onClick={() => setDecision('rejected')}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
            padding: '0.75rem 0.5rem', borderRadius: 'var(--radius-sm)',
            border: `1px solid ${decision === 'rejected' ? '#ef4444' : 'var(--border-primary)'}`,
            background: decision === 'rejected' ? 'rgba(239,68,68,0.1)' : 'var(--bg-elevated)',
            color: decision === 'rejected' ? '#ef4444' : 'var(--text-secondary)',
            transition: 'all 0.2s ease', cursor: 'pointer',
            boxShadow: decision === 'rejected' ? '0 0 10px rgba(239,68,68,0.2)' : 'none'
          }}
        >
          <XCircle size={18} />
          <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>Tolak Laporan (Palsu)</span>
        </button>

        <button
          onClick={() => setDecision('scheduled_check')}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
            padding: '0.75rem 0.5rem', borderRadius: 'var(--radius-sm)',
            border: `1px solid ${decision === 'scheduled_check' ? '#eab308' : 'var(--border-primary)'}`,
            background: decision === 'scheduled_check' ? 'rgba(234,179,8,0.1)' : 'var(--bg-elevated)',
            color: decision === 'scheduled_check' ? '#eab308' : 'var(--text-secondary)',
            transition: 'all 0.2s ease', cursor: 'pointer',
            boxShadow: decision === 'scheduled_check' ? '0 0 10px rgba(234,179,8,0.2)' : 'none'
          }}
        >
          <Search size={18} />
          <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>Tinjau di Lapangan</span>
        </button>
      </div>
      
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          Tambahkan Catatan Moderasi:
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Jelaskan alasan persetujuan, penolakan, atau kebutuhan peninjauan ulang..."
          className="input"
          style={{ minHeight: '80px', width: '100%', resize: 'none' }}
        />
      </div>
      
      <button
        onClick={handleVerify}
        disabled={loading}
        style={{ 
          width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
          background: loading ? 'var(--bg-elevated)' : getButtonBg(),
          color: loading ? 'var(--text-muted)' : 'white',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          fontWeight: 700,
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : '0 4px 15px rgba(0,0,0,0.3)',
          transition: 'all 0.2s ease',
          transform: loading ? 'scale(0.98)' : 'scale(1)'
        }}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Memproses...</span>
          </>
        ) : (
          <>
            <Send size={18} />
            <span>Kirim Keputusan Verifikasi</span>
          </>
        )}
      </button>
    </div>
  );
}
