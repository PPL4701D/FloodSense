'use client';

/**
 * FR-055 (PBI-30) — PWA Installable + Service Worker
 *
 * 1. Mendaftarkan service worker (/sw.js) untuk cache app-shell & offline.
 * 2. Menangkap event beforeinstallprompt → menampilkan banner "Pasang Aplikasi"
 *    (Add to Home Screen). Disembunyikan bila sudah ter-install (standalone) atau
 *    pengguna menutup banner. Dipasang global di AppShell.
 */

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  // Daftarkan service worker untuk PWA (offline shell).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => { /* abaikan */ });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Sudah ter-install (mode standalone)? jangan tampilkan.
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (sessionStorage.getItem('fs-install-dismissed') === '1') return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setShow(false));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setShow(false);
    setDeferred(null);
  };

  const dismiss = () => {
    setShow(false);
    try { sessionStorage.setItem('fs-install-dismissed', '1'); } catch { /* noop */ }
  };

  if (!show) return null;

  return (
    <div
      className="glass"
      style={{
        position: 'fixed', bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
        left: '50%', transform: 'translateX(-50%)', zIndex: 2300,
        width: 'min(420px, calc(100vw - 32px))', padding: '0.75rem 0.875rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-elevated)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/floodsense-logo.png" alt="FloodSense" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.8125rem', fontWeight: 700, margin: 0 }}>Pasang FloodSense</p>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', margin: '1px 0 0' }}>Akses lebih cepat & bisa dibuka offline.</p>
      </div>
      <button onClick={install} className="btn btn-primary" style={{ fontSize: '0.75rem', gap: '0.3rem', padding: '0.45rem 0.75rem', flexShrink: 0 }}>
        <Download size={14} /> Pasang
      </button>
      <button onClick={dismiss} aria-label="Tutup" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0, display: 'flex' }}>
        <X size={15} color="var(--text-muted)" />
      </button>
    </div>
  );
}
