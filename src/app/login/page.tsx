'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@/lib/validators/auth';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, Droplets, Map, Bell, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

const FEATURES = [
  { icon: Droplets, title: 'Lapor Banjir Real-time', desc: 'GPS, foto, & ketinggian air langsung dari lokasi.' },
  { icon: Map, title: 'Peta Interaktif & Heatmap', desc: 'Pantau sebaran & status area banjir nasional.' },
  { icon: Bell, title: 'Peringatan Dini Wilayah', desc: 'Notifikasi untuk titik pantauan pilihan Anda.' },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const supabase = createClient();

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      setServerError(error.message.includes('Invalid login credentials') ? 'Email atau password salah' : error.message);
      return;
    }
    router.push(redirect);
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}` },
    });
    if (error) {
      setServerError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-wrap { position: relative; display: flex; min-height: 100dvh; overflow: hidden; }
        .login-back {
          position: absolute; top: 1.1rem; left: 1.1rem; z-index: 20;
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.5rem 0.875rem; border-radius: var(--radius-md);
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
          color: var(--text-secondary); font-size: 0.8125rem; font-weight: 600;
          text-decoration: none; backdrop-filter: blur(8px); transition: all var(--transition-fast);
        }
        .login-back:hover { background: rgba(255,255,255,0.13); color: var(--text-primary); }
        .login-brand {
          position: relative; flex: 1; overflow: hidden;
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          padding: 3.5rem;
          background:
            radial-gradient(120% 120% at 0% 0%, rgba(59,130,246,0.28), transparent 55%),
            radial-gradient(120% 120% at 100% 100%, rgba(8,145,178,0.30), transparent 55%),
            linear-gradient(135deg, #0b1b34 0%, #0a1428 100%);
          border-right: 1px solid rgba(59,130,246,0.18);
        }
        .login-brand-content { position: relative; z-index: 2; width: 100%; max-width: 460px; }
        .login-watermark {
          position: absolute; top: 48%; left: 50%; width: 540px; max-width: 78%;
          transform: translate(-50%,-50%); opacity: 0.05; z-index: 0; pointer-events: none;
        }
        .login-form-side {
          position: relative; z-index: 5; width: 480px; max-width: 100%;
          display: flex; align-items: center; justify-content: center; padding: 2rem 1.25rem;
        }
        .login-mobile-logo { display: none; }
        .login-waves { position: absolute; left: 0; right: 0; bottom: -1px; width: 100%; z-index: 0; pointer-events: none; }
        .login-waves svg { width: 100%; height: 130px; display: block; }
        .login-waves .w1 { animation: login-wave-x 13s ease-in-out infinite alternate; }
        .login-waves .w2 { animation: login-wave-x 9s ease-in-out infinite alternate-reverse; }
        @keyframes login-wave-x { from { transform: translateX(0); } to { transform: translateX(-45px); } }
        @media (max-width: 900px) {
          .login-brand { display: none; }
          .login-form-side { flex: 1; width: 100%; }
          .login-mobile-logo { display: flex; }
        }
      `}</style>

      <div className="login-wrap gradient-hero">
        <Link href="/" className="login-back"><ArrowLeft size={15} /> Beranda</Link>

        {/* Wave animasi full-width di bawah */}
        <div className="login-waves" aria-hidden="true">
          <svg viewBox="0 0 1440 140" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path className="w1" fill="rgba(59,130,246,0.16)" d="M0,80 C240,140 480,20 720,60 C960,100 1200,150 1440,80 L1440,140 L0,140 Z" />
            <path className="w2" fill="rgba(8,145,178,0.14)" d="M0,100 C240,60 480,150 720,100 C960,55 1200,130 1440,96 L1440,140 L0,140 Z" />
          </svg>
        </div>

        {/* ── Branding panel (desktop) ── */}
        <aside className="login-brand">
          <img src="/floodsense-logo.png" alt="" aria-hidden="true" className="login-watermark" />
          <div className="login-brand-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
              <img src="/floodsense-logo.png" alt="FloodSense" width={52} height={52} style={{ objectFit: 'contain' }} />
              <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                <span className="text-gradient">Flood</span>Sense
              </span>
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.2, maxWidth: '20ch', marginBottom: '0.75rem' }}>
              Pantau & laporkan banjir, <span className="text-gradient">selamatkan</span> lebih banyak orang.
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '36ch', marginBottom: '2rem' }}>
              Platform crowdsourcing pemantauan banjir nasional berbasis peta real-time.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {FEATURES.map((f) => (
                <div key={f.title} style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0, width: '38px', height: '38px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <f.icon size={18} color="var(--primary-400)" />
                  </span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>{f.title}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '2px 0 0' }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Form side ── */}
        <main className="login-form-side">
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
            {/* Logo mobile (panel kiri tersembunyi di mobile) */}
            <div className="login-mobile-logo" style={{ flexDirection: 'column', alignItems: 'center', marginBottom: '1.75rem' }}>
              <img src="/floodsense-logo.png" alt="FloodSense" width={56} height={56} style={{ objectFit: 'contain', marginBottom: '0.5rem' }} />
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                <span className="text-gradient">Flood</span>Sense
              </h1>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.35rem' }}>Selamat datang kembali 👋</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Masuk ke platform pemantauan banjir Indonesia</p>
            </div>

            <div className="card" style={{ padding: '1.75rem' }}>
              {serverError && (
                <div className="animate-slide-down" style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  marginBottom: '1.25rem', fontSize: '0.8125rem', color: '#ef4444'
                }}>
                  <AlertCircle size={16} />
                  {serverError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label htmlFor="email" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>Email</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input id="email" type="email" className={`input ${errors.email ? 'input-error' : ''}`} style={{ paddingLeft: '2.5rem' }} placeholder="nama@email.com" autoComplete="email" {...register('email')} />
                  </div>
                  {errors.email && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{errors.email.message}</p>}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <label htmlFor="password" style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
                    <Link href="/reset-password" style={{ fontSize: '0.75rem', color: 'var(--primary-400)', textDecoration: 'none' }}>Lupa password?</Link>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input id="password" type={showPassword ? 'text' : 'password'} className={`input ${errors.password ? 'input-error' : ''}`} style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }} placeholder="Masukkan password" autoComplete="current-password" {...register('password')} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{errors.password.message}</p>}
                </div>

                <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ width: '100%', marginTop: '0.5rem' }}>
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Memproses...</> : 'Masuk'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-primary)' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>atau</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-primary)' }} />
              </div>

              <button onClick={handleGoogleLogin} className="btn btn-secondary" disabled={googleLoading} style={{ width: '100%' }}>
                {googleLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                Masuk dengan Google
              </button>
            </div>

            <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Belum punya akun?{' '}
              <Link href="/register" style={{ color: 'var(--primary-400)', fontWeight: 600, textDecoration: 'none' }}>Daftar sekarang</Link>
            </p>
          </div>
        </main>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
