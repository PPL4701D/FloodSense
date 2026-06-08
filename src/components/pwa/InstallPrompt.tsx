'use client';

/**
 * FR-055 (PBI-30) — PWA Installable + Service Worker
 *
 * 1. Mendaftarkan service worker (/sw.js) untuk cache app-shell & offline.
 * 2. Menangkap event beforeinstallprompt → menampilkan kartu "Pasang Aplikasi"
 *    di pojok kanan bawah (tidak menabrak navbar/peta). Tombol tutup MENGECILKAN
 *    kartu menjadi logo (FAB) di pojok; klik logo untuk membuka lagi.
 *    Disembunyikan bila sudah ter-install (standalone). Dipasang global di AppShell.
 */

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type View = 'hidden' | 'banner' | 'mini';

const ANCHOR: React.CSSProperties = {
  position: 'fixed',
  bottom: 'calc(160px + env(safe-area-inset-bottom, 0px))',
  left: '16px',
  zIndex: 2300,
};

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [view, setView] = useState<View>('hidden');

  // Daftarkan service worker untuk PWA (offline shell).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => { /* abaikan */ });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    // Mulai dari kondisi mini bila pengguna sudah pernah minimize di sesi ini.
    const start: View = sessionStorage.getItem('fs-install-mini') === '1' ? 'mini' : 'banner';

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setView(start);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setView('hidden'));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setView('hidden');
    setDeferred(null);
  };

  const minimize = () => {
    setView('mini');
    try { sessionStorage.setItem('fs-install-mini', '1'); } catch { /* noop */ }
  };

  if (view === 'hidden') return null;

  // Logo FAB (minimized)
  if (view === 'mini') {
    return (
      <button
        onClick={() => setView('banner')}
        title="Pasang FloodSense"
        aria-label="Pasang FloodSense"
        style={{
          ...ANCHOR,
          width: '56px', height: '56px', padding: 0,
          border: 'none', background: 'transparent', cursor: 'pointer',
          filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.45))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/floodsense-logo.png" alt="FloodSense" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        <span style={{
          position: 'absolute', top: '-2px', right: '-2px', width: '16px', height: '16px',
          borderRadius: '50%', background: 'var(--primary-500)', border: '2px solid var(--bg-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Download size={9} color="#fff" />
        </span>
      </button>
    );
  }

  // Kartu banner (expanded)
  return (
    <div
      className="glass"
      style={{
        ...ANCHOR,
        width: 'min(320px, calc(100vw - 32px))', padding: '0.75rem 0.875rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ width: '44px', height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/floodsense-logo.png" alt="FloodSense" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.8125rem', fontWeight: 700, margin: 0 }}>Pasang FloodSense</p>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', margin: '1px 0 0' }}>Akses lebih cepat & bisa dibuka offline.</p>
      </div>
      <button onClick={install} className="btn btn-primary" style={{ fontSize: '0.75rem', gap: '0.3rem', padding: '0.45rem 0.7rem', flexShrink: 0 }}>
        <Download size={14} /> Pasang
      </button>
      <button onClick={minimize} aria-label="Kecilkan" title="Kecilkan" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0, display: 'flex' }}>
        <X size={15} color="var(--text-muted)" />
      </button>
    </div>
  );
}
