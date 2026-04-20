'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterFormData } from '@/lib/validators/auth';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, User, Droplets, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const supabase = createClient();

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.full_name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        setServerError('Email sudah terdaftar. Silakan masuk.');
      } else {
        setServerError(error.message);
      }
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <div className="gradient-hero" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div className="animate-fade-in card" style={{ maxWidth: '420px', width: '100%', padding: '2rem', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '64px', height: '64px', borderRadius: 'var(--radius-full)',
            background: 'rgba(34,197,94,0.15)', marginBottom: '1rem'
          }}>
            <CheckCircle2 size={32} color="#22c55e" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Pendaftaran Berhasil!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Kami telah mengirimkan email verifikasi ke alamat email Anda. Silakan cek inbox dan klik link verifikasi untuk mengaktifkan akun.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ width: '100%' }}>
            Kembali ke Halaman Masuk
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-hero" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '64px', height: '64px', borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--primary-600), #0891b2)',
            marginBottom: '1rem', boxShadow: '0 0 30px rgba(59,130,246,0.3)'
          }}>
            <Droplets size={32} color="white" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            <span className="text-gradient">Buat Akun</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Bergabung untuk melaporkan dan memantau banjir
          </p>
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
            {/* Full Name */}
            <div>
              <label htmlFor="full_name" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
                Nama Lengkap
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="full_name" type="text" className={`input ${errors.full_name ? 'input-error' : ''}`}
                  style={{ paddingLeft: '2.5rem' }} placeholder="Nama lengkap Anda" {...register('full_name')} />
              </div>
              {errors.full_name && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{errors.full_name.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="email" type="email" className={`input ${errors.email ? 'input-error' : ''}`}
                  style={{ paddingLeft: '2.5rem' }} placeholder="nama@email.com" autoComplete="email" {...register('email')} />
              </div>
              {errors.email && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="password" type={showPassword ? 'text' : 'password'}
                  className={`input ${errors.password ? 'input-error' : ''}`}
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  placeholder="Min. 8 karakter, huruf besar & angka" autoComplete="new-password"
                  {...register('password')} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{errors.password.message}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm_password" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
                Konfirmasi Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="confirm_password" type={showPassword ? 'text' : 'password'}
                  className={`input ${errors.confirm_password ? 'input-error' : ''}`}
                  style={{ paddingLeft: '2.5rem' }} placeholder="Ulangi password"
                  autoComplete="new-password" {...register('confirm_password')} />
              </div>
              {errors.confirm_password && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{errors.confirm_password.message}</p>}
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ width: '100%', marginTop: '0.5rem' }}>
              {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Mendaftar...</> : 'Daftar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Sudah punya akun?{' '}
          <Link href="/login" style={{ color: 'var(--primary-400)', fontWeight: 600, textDecoration: 'none' }}>
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
