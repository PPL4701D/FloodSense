'use client';

/**
 * FR-056 (PBI-31) — Bagikan Laporan
 *
 * Tombol bagikan di detail laporan. Memakai Web Share API bila didukung
 * (sheet native), jika tidak tampil fallback: salin tautan + tombol cepat
 * WhatsApp / Telegram / X. Preview tautan dirender oleh opengraph-image.tsx.
 */

import { useEffect, useRef, useState } from 'react';
import { Share2, Link2, Check, MessageCircle, Send } from 'lucide-react';

interface ShareButtonProps {
  reportId: string;
  title?: string;
  text?: string;
}

export default function ShareButton({ reportId, title = 'Laporan Banjir FloodSense', text }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') setUrl(`${window.location.origin}/report/${reportId}`);
  }, [reportId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const shareText = text || `${title} — pantau kondisi banjir terkini di FloodSense`;

  const handleClick = async () => {
    // Web Share API (mobile/native)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url });
        return;
      } catch {
        // user batal / tidak didukung → buka fallback
      }
    }
    setOpen((o) => !o);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const enc = encodeURIComponent;
  const targets = [
    { label: 'WhatsApp', icon: MessageCircle, color: '#25D366', href: `https://wa.me/?text=${enc(shareText + ' ' + url)}` },
    { label: 'Telegram', icon: Send, color: '#229ED9', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(shareText)}` },
    { label: 'X', icon: Share2, color: '#1d9bf0', href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(shareText)}` },
  ];

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={handleClick}
        title="Bagikan laporan"
        aria-label="Bagikan"
        style={{
          width: '36px', height: '36px', borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Share2 size={17} color="var(--text-secondary)" />
      </button>

      {open && (
        <div
          className="glass"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200,
            width: '230px', padding: '0.5rem', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)', boxShadow: 'var(--shadow-lg)',
          }}
        >
          <button
            onClick={copy}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
              padding: '0.5rem 0.625rem', background: 'none', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--radius-sm)', textAlign: 'left', color: 'var(--text-primary)', fontSize: '0.8125rem',
            }}
          >
            {copied ? <Check size={15} color="#22c55e" /> : <Link2 size={15} color="var(--primary-400)" />}
            {copied ? 'Tautan disalin!' : 'Salin tautan'}
          </button>
          <div style={{ height: '1px', background: 'var(--border-primary)', margin: '0.25rem 0' }} />
          {targets.map((t) => (
            <a
              key={t.label}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.625rem', borderRadius: 'var(--radius-sm)',
                textDecoration: 'none', color: 'var(--text-primary)', fontSize: '0.8125rem',
              }}
            >
              <t.icon size={15} color={t.color} /> {t.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
